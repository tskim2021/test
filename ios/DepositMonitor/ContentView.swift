import SwiftUI
import WebKit

struct ContentView: View {
    @EnvironmentObject var settings: Settings
    @State private var showSettings = false
    @State private var reloadTick = 0

    var body: some View {
        ZStack {
            if let url = settings.dashboardURL {
                DashboardWebView(url: url, reloadTick: reloadTick)
                    .ignoresSafeArea(edges: .bottom)
            } else {
                Text("⚙️ 서버 주소와 접속 토큰을 먼저 입력하세요").foregroundColor(.secondary)
            }
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button { showSettings = true } label: {
                        Image(systemName: "gearshape.fill").padding(12).background(.ultraThinMaterial).clipShape(Circle())
                    }.padding(.trailing, 12).padding(.bottom, 18)
                }
            }
        }
        .sheet(isPresented: $showSettings, onDismiss: { reloadTick += 1; AppDelegate.registerForPush(); AppDelegate.uploadToken() }) {
            SettingsView().environmentObject(settings)
        }
        .onAppear {
            if !settings.configured { showSettings = true }
            AppDelegate.registerForPush()
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject var settings: Settings
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("서버"), footer: Text("https:// 로 시작하는 주소만 쓸 수 있어요 (iOS 보안 정책).")) {
                    TextField("https://deposit.example.com", text: $settings.serverURL)
                        .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                    SecureField("접속 토큰 (VIEW_TOKEN 또는 ADMIN_TOKEN)", text: $settings.token)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                }
                Section(header: Text("푸시")) {
                    Text(settings.pushStatus).font(.footnote)
                    Button("푸시 테스트 보내기") { sendTest() }.disabled(!settings.configured)
                }
            }
            .navigationTitle("입금 모니터")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("완료") { dismiss() } } }
        }
    }

    private func sendTest() {
        let base = settings.serverURL.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
        guard let url = URL(string: base + "/api/push/test") else { return }
        var req = URLRequest(url: url, timeoutInterval: 15)
        req.httpMethod = "POST"
        req.setValue("Bearer \(settings.token)", forHTTPHeaderField: "Authorization")
        URLSession.shared.dataTask(with: req) { _, resp, _ in
            DispatchQueue.main.async {
                let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
                settings.pushStatus = code == 200 ? "푸시: 테스트를 보냈어요. 잠시 후 알림이 오는지 확인하세요" : "푸시: 테스트 실패 (HTTP \(code))"
            }
        }.resume()
    }
}

/// 대시보드를 보여주는 WKWebView. 당겨서 새로고침, 새 창 링크·JS 알림창 처리.
struct DashboardWebView: UIViewRepresentable {
    let url: URL
    let reloadTick: Int

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let wv = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        wv.navigationDelegate = context.coordinator
        wv.uiDelegate = context.coordinator
        let rc = UIRefreshControl()
        rc.addTarget(context.coordinator, action: #selector(Coordinator.refresh(_:)), for: .valueChanged)
        wv.scrollView.refreshControl = rc
        context.coordinator.webView = wv
        wv.load(URLRequest(url: url))
        context.coordinator.loaded = url
        context.coordinator.tick = reloadTick
        return wv
    }

    func updateUIView(_ wv: WKWebView, context: Context) {
        let c = context.coordinator
        if c.loaded != url || c.tick != reloadTick {
            c.loaded = url; c.tick = reloadTick
            wv.load(URLRequest(url: url))
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        weak var webView: WKWebView?
        var loaded: URL?
        var tick = 0

        @objc func refresh(_ rc: UIRefreshControl) { webView?.reload() }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { webView.scrollView.refreshControl?.endRefreshing() }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { webView.scrollView.refreshControl?.endRefreshing() }

        // target=_blank (상품보기 등)는 사파리로 연다.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let u = navigationAction.request.url { UIApplication.shared.open(u) }
            return nil
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            present(UIAlertController(title: nil, message: message, preferredStyle: .alert), actions: [("확인", .default, { completionHandler() })])
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            present(UIAlertController(title: nil, message: message, preferredStyle: .alert),
                    actions: [("취소", .cancel, { completionHandler(false) }), ("확인", .default, { completionHandler(true) })])
        }

        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
            let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
            a.addTextField { $0.text = defaultText }
            let ok = UIAlertAction(title: "확인", style: .default) { _ in completionHandler(a.textFields?.first?.text) }
            let cancel = UIAlertAction(title: "취소", style: .cancel) { _ in completionHandler(nil) }
            a.addAction(cancel); a.addAction(ok)
            top()?.present(a, animated: true)
        }

        private func present(_ a: UIAlertController, actions: [(String, UIAlertAction.Style, () -> Void)]) {
            for (t, s, h) in actions { a.addAction(UIAlertAction(title: t, style: s) { _ in h() }) }
            top()?.present(a, animated: true)
        }

        private func top() -> UIViewController? {
            var vc = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first?.rootViewController
            while let p = vc?.presentedViewController { vc = p }
            return vc
        }
    }
}
