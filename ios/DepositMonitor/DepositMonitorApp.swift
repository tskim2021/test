import SwiftUI
import UserNotifications

@main
struct DepositMonitorApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var settings = Settings.shared

    var body: some Scene {
        WindowGroup {
            ContentView().environmentObject(settings)
        }
    }
}

/// 서버 주소·접속 토큰 저장
final class Settings: ObservableObject {
    static let shared = Settings()
    @Published var serverURL: String { didSet { UserDefaults.standard.set(serverURL, forKey: "serverURL") } }
    @Published var token: String { didSet { UserDefaults.standard.set(token, forKey: "token") } }
    @Published var pushStatus = "푸시: 대기 중"

    init() {
        serverURL = UserDefaults.standard.string(forKey: "serverURL") ?? ""
        token = UserDefaults.standard.string(forKey: "token") ?? ""
    }

    var configured: Bool { URL(string: serverURL)?.host != nil && !token.isEmpty }

    /// 대시보드 주소. 토큰은 #fragment 로 넘겨 서버 로그에 남지 않는다. app=1 은 앱용 compact 화면.
    var dashboardURL: URL? {
        guard configured else { return nil }
        let base = serverURL.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
        let t = token.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? token
        return URL(string: "\(base)/#token=\(t)&app=1")
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    static var deviceToken: String?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    /// 알림 권한 요청 후 APNs 등록. 설정 저장 후에도 호출된다.
    static func registerForPush() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            DispatchQueue.main.async {
                if granted { UIApplication.shared.registerForRemoteNotifications() }
                else { Settings.shared.pushStatus = "푸시: 알림 권한이 꺼져 있어요 (설정 > 알림)" }
            }
        }
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        AppDelegate.deviceToken = deviceToken.map { String(format: "%02x", $0) }.joined()
        AppDelegate.uploadToken()
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Settings.shared.pushStatus = "푸시: 등록 실패 — \(error.localizedDescription)"
    }

    /// 기기 토큰을 서버에 등록한다(앱 실행·설정 변경 때마다 호출해도 안전).
    static func uploadToken() {
        let s = Settings.shared
        guard let dt = deviceToken, s.configured,
              let url = URL(string: s.serverURL.trimmingCharacters(in: CharacterSet(charactersIn: "/ ")) + "/api/apns/register") else { return }
        #if DEBUG
        let sandbox = true   // Xcode 로 직접 설치한 개발 빌드
        #else
        let sandbox = false  // TestFlight / App Store
        #endif
        var req = URLRequest(url: url, timeoutInterval: 15)
        req.httpMethod = "POST"
        req.setValue("Bearer \(s.token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["token": dt, "sandbox": sandbox])
        URLSession.shared.dataTask(with: req) { data, resp, err in
            DispatchQueue.main.async {
                let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
                if code == 200 {
                    let enabled = ((try? JSONSerialization.jsonObject(with: data ?? Data())) as? [String: Any])?["enabled"] as? Bool ?? false
                    s.pushStatus = enabled ? "푸시: 서버에 등록됨 ✅" : "푸시: 등록은 됐지만 서버에 APNs 설정이 없어요"
                } else if code == 401 {
                    s.pushStatus = "푸시: 접속 토큰이 올바르지 않아요"
                } else {
                    s.pushStatus = "푸시: 서버 등록 실패 (\(code == 0 ? (err?.localizedDescription ?? "연결 불가") : "HTTP \(code)"))"
                }
            }
        }.resume()
    }

    // 앱이 켜져 있을 때도 배너를 보여준다.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .list])
    }
}
