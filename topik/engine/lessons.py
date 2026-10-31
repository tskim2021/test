# TOPIK 1급 2~10강 강의 데이터. T(영어, 일본어, 중국어)
T=lambda en,ja,zh:dict(en=en,ja=ja,zh=zh)
def syl(s):  # "일:il 이:i _ 삼:sam"  ('_' = 띄어쓰기)
    return [None if t=='_' else tuple(t.split(':')) for t in s.split()]
G=dict(
 repeat=T("Now, repeat after me.","続けて言いましょう。","跟我一起读。"),
 together=T("Put them together.","つなげると。","连起来。"),
 listen=T("Listen to the real sound.","実際の発音を聞いてみましょう。","听一听实际的发音。"),
 bye=T("Great job! See you next lesson.","お疲れさま！次のレッスンで会いましょう。","做得好！下节课见。"),
 noun=T("NOUN","名詞","名词"),number=T("NUMBER","数詞","数词"),counter=T("COUNTER","助数詞","量词"),
 cop=T("VERB · TO BE","です","动词 · 是"),pron=T("PRONOUN + TOPIC","代名詞 + は","代词 + 主题助词"),
 verb=T("VERB","動詞","动词"),subj=T("SUBJECT","主語","主语"),place=T("PLACE + 에","場所 + 에","地点 + 에"),
 dem=T("THIS/THAT + TOPIC","これ/あれ + は","这/那 + 主题助词"),timet=T("TIME + TOPIC","時 + は","时间 + 主题助词"),
 hour=T("HOUR · NATIVE","時 · 固有語","钟点 · 固有词"),minute=T("MINUTES · SINO","分 · 漢数詞","分钟 · 汉字词"),
 numcnt=T("NUMBER + COUNTER","数 + 助数詞","数量 + 量词"),req=T("PLEASE GIVE","ください","请给我"))
def note(w,s,rule,c_listen=None):
    return dict(w=f"<span class='hl'>{w}</span>",s=f"<span class='hl'>{s}</span>",rule=rule,say=s.replace(' ','')+'.')
LINK=T("Linking sound","連音","连读"); HARD=T("Hard sound","濃い音","紧音")
def expr(kicker,say,disp,sy,meaning,ctx,explain,repeat=False,nt=None):
    return dict(type='expr',kicker=kicker,say=say,disp=disp,syl=syl(sy),meaning=meaning,ctx=ctx,explain=explain,repeat=repeat,note=nt)
def build(kicker,cards,full,use,ops=('+','+')):
    return dict(type='build',kicker=kicker,cards=cards,full=full,use=use,ops=list(ops))
def card(ko,rom,tag,gloss,say=None): return dict(ko=ko,rom=rom,tag=tag,gloss=gloss,say=say or ko+'.')
def quiz(prompt,ko,rom,say=None,ask=None,qlabel=None): return dict(type='quiz',prompt=prompt,ko=ko,rom=rom,say=say or ko+'.',ask=ask,qlabel=qlabel)
def outro(recap): return dict(type='outro',recap=recap)

LESSONS={
2:dict(title="숫자 1",decor="일이삼사오",topic=T("numbers one","数字その1","数字（一）"),sub=T("Numbers 1 · Sino-Korean","数字その1 · 漢数詞","数字（一）· 汉字词"),scenes=[
 expr(T("NUMBERS · 숫자","数字 · 숫자","数字 · 숫자"),"일, 이, 삼, 사, 오.","일 이 삼 사 오","일:il 이:i 삼:sam 사:sa 오:o",
  T("1 · 2 · 3 · 4 · 5","1 · 2 · 3 · 4 · 5","1 · 2 · 3 · 4 · 5"),T("Phone numbers, dates, money","電話番号・日付・お金","电话号码、日期、金额"),
  T("These are Sino-Korean numbers. Use them for phone numbers, dates, and money.","漢数詞です。電話番号や日付、お金に使います。","这是汉字词数字，用于电话号码、日期和金额。"),repeat=True),
 expr(T("NUMBERS · 6-10","数字 · 6〜10","数字 · 6-10"),"육, 칠, 팔, 구, 십.","육 칠 팔 구 십","육:yuk 칠:chil 팔:pal 구:gu 십:sip",
  T("6 · 7 · 8 · 9 · 10","6 · 7 · 8 · 9 · 10","6 · 7 · 8 · 9 · 10"),T("Counting up to ten","十まで数える","数到十"),
  T("Six to ten. Ten is sip.","六から十まで。十は、シプです。","六到十。十读作sip。")),
 build(T("NUMBER + 번","数字 + 번","数字 + 번"),[card("삼","sam",G['number'],T("three","三","三")),card("번","beon",G['counter'],T("number","番","号")),card("입니다","im-ni-da",G['cop'],T("is","です","是"))],
  dict(ko="삼 번입니다.",rom="sam beon-im-ni-da",loc=T("It is number three.","三番です。","是三号。"),say="삼 번입니다."),
  T("Use it to say a number, like a bus or a room.","バスや部屋の番号を言うときに使います。","用来说号码，比如公交车或房间号。")),
 quiz(T("8","8","8"),"팔","pal"),
 outro([("일 이 삼",T("1 · 2 · 3","1 · 2 · 3","1 · 2 · 3"),"il i sam"),("육 칠 팔",T("6 · 7 · 8","6 · 7 · 8","6 · 7 · 8"),"yuk chil pal"),("삼 번입니다",T("It is number three","三番です","是三号"),"sam beon-im-ni-da")])]),
3:dict(title="숫자 2",decor="하나둘셋넷",topic=T("numbers two","数字その2","数字（二）"),sub=T("Numbers 2 · Native Korean","数字その2 · 固有語","数字（二）· 固有词"),scenes=[
 expr(T("NUMBERS · 하나 둘 셋","数字 · 하나 둘 셋","数字 · 하나 둘 셋"),"하나, 둘, 셋, 넷.","하나 둘 셋 넷","하:ha 나:na 둘:dul 셋:set 넷:net",
  T("1 · 2 · 3 · 4","1 · 2 · 3 · 4","1 · 2 · 3 · 4"),T("Counting things, age, hours","物を数える・年齢・時間","数物品、年龄、钟点"),
  T("These are native Korean numbers. Use them to count things, and for hours.","固有語の数字です。物を数えるときや、時間に使います。","这是固有词数字，用来数东西，也用于钟点。"),repeat=True),
 expr(T("NUMBERS · 5-7","数字 · 5〜7","数字 · 5-7"),"다섯, 여섯, 일곱.","다섯 여섯 일곱","다:da 섯:seot _ 여:yeo 섯:seot _ 일:il 곱:gop",
  T("5 · 6 · 7","5 · 6 · 7","5 · 6 · 7"),T("Keep counting to ten","十まで続ける","一直数到十"),
  T("Five, six, seven. Keep going up to ten.","五、六、七。十まで続けましょう。","五、六、七。一直数到十。")),
 build(T("COUNTING · 개","数える · 개","数量 · 개"),[card("사과","sa-gwa",G['noun'],T("apple","りんご","苹果")),card("세","se",G['number'],T("three","三つ","三")),card("개","gae",G['counter'],T("pieces","個","个"))],
  dict(ko="사과 세 개",rom="sa-gwa se gae",loc=T("Three apples.","りんご三個。","三个苹果。"),say="사과 세 개."),
  T("Native numbers go with counters. Three becomes se before a counter.","固有語の数字は助数詞と使います。三は、セに変わります。","固有词数字要和量词一起用。三要变成se。")),
 quiz(T("2","2","2"),"둘","dul"),
 outro([("하나 둘 셋",T("1 · 2 · 3","1 · 2 · 3","1 · 2 · 3"),"ha-na dul set"),("다섯 여섯 일곱",T("5 · 6 · 7","5 · 6 · 7","5 · 6 · 7"),"da-seot yeo-seot il-gop"),("사과 세 개",T("Three apples","りんご三個","三个苹果"),"sa-gwa se gae")])]),
4:dict(title="이것/저것",decor="이것저것무엇",topic=T("this and that","これとあれ","这个和那个"),sub=T("This and that · 이것 저것","これとあれ · 이것 저것","这个和那个 · 이것 저것"),scenes=[
 expr(T("ASK · 질문","質問 · 질문","提问 · 질문"),"이것은 무엇입니까?","이것은 무엇입니까?","이:i 것:geo 은:seun _ 무:mu 엇:eo 입:im 니:ni 까:kka",
  T("What is this?","これは何ですか？","这是什么？"),T("Asking about an object","ものについて聞く","询问物品"),
  T("Use it to ask what something is. It is a polite, formal question.","ものが何かを聞くときに使います。丁寧でフォーマルな質問です。","用来询问某物是什么。这是礼貌、正式的问法。"),repeat=True,
  nt=dict(w="<span class='hl'>무엇입니까</span>",s="<span class='hl'>무어심니까</span>",rule=T("Linking + ㅂ → ㅁ","連音 + ㅂ → ㅁ","连读 + ㅂ → ㅁ"),say="무어심니까.")),
 expr(T("ANSWER · 대답","答え · 대답","回答 · 대답"),"이것은 책입니다.","이것은 책입니다.","이:i 것:geo 은:seun _ 책:chaek 입:im 니:ni 다:da",
  T("This is a book.","これは本です。","这是书。"),T("Answer with 입니다","입니다で答える","用입니다回答"),
  T("Answer with the noun plus imnida. Book is chaek.","名詞に、입니다をつけて答えます。本は、チェクです。","名词后面加입니다来回答。书是chaek。")),
 build(T("THAT · 저것","あれ · 저것","那个 · 저것"),[card("저것은","jeo-geo-seun",G['dem'],T("that (over there)","あれは","那个")),card("가방","ga-bang",G['noun'],T("bag","かばん","包")),card("입니다","im-ni-da",G['cop'],T("is","です","是"))],
  dict(ko="저것은 가방입니다.",rom="jeo-geo-seun ga-bang-im-ni-da",loc=T("That is a bag.","あれはかばんです。","那是包。"),say="저것은 가방입니다."),
  T("Use 저것 for things far from both of you.","お互いから遠いものには、저것を使います。","离双方都远的东西用저것。")),
 quiz(T("What is this?","これは何ですか？","这是什么？"),"이것은 무엇입니까?","i-geo-seun mu-eo-sim-ni-kka"),
 outro([("이것은 무엇입니까?",T("What is this?","これは何ですか？","这是什么？"),"i-geo-seun mu-eo-sim-ni-kka"),("이것은 책입니다",T("This is a book","これは本です","这是书"),"i-geo-seun chaek-im-ni-da"),("저것은 가방입니다",T("That is a bag","あれはかばんです","那是包"),"jeo-geo-seun ga-bang-im-ni-da")])]),
5:dict(title="나라와 직업",decor="한국사람나라",topic=T("countries and jobs","国と職業","国家和职业"),sub=T("Countries and jobs · 나라 직업","国と職業 · 나라 직업","国家和职业 · 나라 직업"),scenes=[
 expr(T("COUNTRY · 나라","国 · 나라","国家 · 나라"),"한국 사람입니다.","한국 사람입니다.","한:han 국:guk _ 사:sa 람:ram 입:im 니:ni 다:da",
  T("I am Korean.","韓国人です。","我是韩国人。"),T("Saying your nationality","国籍を言う","说明国籍"),
  T("Country plus saram means a person from that country. Say it with imnida.","国の名前に、サラムをつけると、その国の人です。","国家名加사람，就是那个国家的人。"),repeat=True,
  nt=dict(w="<span class='hl'>한국 사람</span>",s="<span class='hl'>한국 싸람</span>",rule=HARD,say="한국 싸람.")),
 expr(T("ASK · 질문","質問 · 질문","提问 · 질문"),"어느 나라예요?","어느 나라예요?","어:eo 느:neu _ 나:na 라:ra 예:ye 요:yo",
  T("Which country?","どこの国ですか？","哪个国家？"),T("Asking where someone is from","出身を聞く","询问对方来自哪里"),
  T("Use it to ask which country someone is from.","相手がどこの国の人か聞くときに使います。","用来询问对方来自哪个国家。")),
 build(T("JOB · 직업","職業 · 직업","职业 · 직업"),[card("저는","jeo-neun",G['pron'],T("I","私は","我")),card("선생님","seon-saeng-nim",G['noun'],T("teacher","先生","老师")),card("입니다","im-ni-da",G['cop'],T("am","です","是"))],
  dict(ko="저는 선생님입니다.",rom="jeo-neun seon-saeng-nim-im-ni-da",loc=T("I am a teacher.","私は先生です。","我是老师。"),say="저는 선생님입니다."),
  T("Swap the noun to say your own job.","名詞を変えれば、自分の職業が言えます。","替换名词，就能说自己的职业。")),
 quiz(T("I am Korean","韓国人です","我是韩国人"),"한국 사람입니다","han-guk sa-ram-im-ni-da"),
 outro([("한국 사람입니다",T("I am Korean","韓国人です","我是韩国人"),"han-guk sa-ram-im-ni-da"),("어느 나라예요?",T("Which country?","どこの国ですか？","哪个国家？"),"eo-neu na-ra-ye-yo"),("저는 선생님입니다",T("I am a teacher","私は先生です","我是老师"),"jeo-neun seon-saeng-nim-im-ni-da")])]),
6:dict(title="장소",decor="학교집에어디",topic=T("places","場所","地点"),sub=T("Places · 장소","場所 · 장소","地点 · 장소"),scenes=[
 expr(T("PLACE · 장소","場所 · 장소","地点 · 장소"),"학교에 있어요.","학교에 있어요.","학:hak 교:gyo 에:e _ 있:iss 어:eo 요:yo",
  T("I am at school.","学校にいます。","我在学校。"),T("Saying where you are","いる場所を言う","说明所在的位置"),
  T("Place plus e means at or in. Isseoyo means there is, or I am.","場所に、에をつけると、「〜に」です。있어요は、「います、あります」です。","地点加에表示“在”。있어요表示“有、在”。"),repeat=True,
  nt=dict(w="<span class='hl'>있어요</span>",s="<span class='hl'>이써요</span>",rule=LINK,say="이써요.")),
 expr(T("ASK · 질문","質問 · 질문","提问 · 질문"),"어디에 있어요?","어디에 있어요?","어:eo 디:di 에:e _ 있:iss 어:eo 요:yo",
  T("Where is it?","どこにありますか？","在哪里？"),T("Asking where something is","ものの場所を聞く","询问东西在哪里"),
  T("Eodi means where. Use it to ask where something or someone is.","어디は「どこ」です。ものや人の場所を聞くときに使います。","어디是“哪里”。用来询问东西或人在哪里。")),
 build(T("SENTENCE · 문장","文 · 문장","句子 · 문장"),[card("책이","chae-gi",G['subj'],T("the book","本が","书")),card("가방에","ga-bang-e",G['place'],T("in the bag","かばんに","在包里")),card("있어요","iss-eo-yo",G['verb'],T("is there","あります","有"))],
  dict(ko="책이 가방에 있어요.",rom="chae-gi ga-bang-e iss-eo-yo",loc=T("The book is in the bag.","本はかばんの中にあります。","书在包里。"),say="책이 가방에 있어요."),
  T("Subject, place, verb. That is the Korean order.","主語、場所、動詞の順に並べます。","主语、地点、动词，这就是韩语的语序。")),
 quiz(T("Where is it?","どこにありますか？","在哪里？"),"어디에 있어요?","eo-di-e iss-eo-yo"),
 outro([("학교에 있어요",T("I am at school","学校にいます","我在学校"),"hak-gyo-e iss-eo-yo"),("어디에 있어요?",T("Where is it?","どこにありますか？","在哪里？"),"eo-di-e iss-eo-yo"),("책이 가방에 있어요",T("The book is in the bag","本はかばんの中","书在包里"),"chae-gi ga-bang-e iss-eo-yo")])]),
7:dict(title="시간",decor="시분지금몇",topic=T("telling time","時間","时间"),sub=T("Telling time · 시간","時間 · 시간","时间 · 시간"),scenes=[
 expr(T("TIME · 시간","時間 · 시간","时间 · 시간"),"지금 몇 시예요?","지금 몇 시예요?","지:ji 금:geum _ 몇:myeot 시:si 예:ye 요:yo",
  T("What time is it now?","今、何時ですか？","现在几点？"),T("Asking the time","時刻を聞く","询问时间"),
  T("Jigeum means now. Myeot si means what time.","지금は「今」です。몇 시は「何時」です。","지금是“现在”。몇 시是“几点”。"),repeat=True,
  nt=dict(w="<span class='hl'>몇 시</span>",s="<span class='hl'>멷 씨</span>",rule=HARD,say="멷씨.")),
 expr(T("ANSWER · 대답","答え · 대답","回答 · 대답"),"세 시예요.","세 시예요.","세:se _ 시:si 예:ye 요:yo",
  T("It is three o'clock.","三時です。","三点钟。"),T("Hours use native numbers","時間は固有語の数字","钟点用固有词数字"),
  T("For hours, use native numbers. Three o'clock is se si.","時間には固有語の数字を使います。三時は、セ シです。","钟点用固有词数字。三点是se si。")),
 build(T("2:30 · 두 시 삼십 분","2:30 · 두 시 삼십 분","2:30 · 두 시 삼십 분"),[card("두 시","du si",G['hour'],T("two o'clock","二時","两点")),card("삼십 분","sam-sip bun",G['minute'],T("30 minutes","30分","30分钟")),card("입니다","im-ni-da",G['cop'],T("is","です","是"))],
  dict(ko="두 시 삼십 분입니다.",rom="du si sam-sip bun-im-ni-da",loc=T("It is 2:30.","二時三十分です。","现在是两点三十分。"),say="두 시 삼십 분입니다."),
  T("Hours use native numbers. Minutes use Sino-Korean numbers.","時間は固有語、分は漢数詞を使います。","钟点用固有词数字，分钟用汉字词数字。")),
 quiz(T("What time is it?","何時ですか？","几点？"),"몇 시예요?","myeot si-ye-yo"),
 outro([("지금 몇 시예요?",T("What time is it now?","今、何時ですか？","现在几点？"),"ji-geum myeot si-ye-yo"),("세 시예요",T("It is three o'clock","三時です","三点钟"),"se si-ye-yo"),("두 시 삼십 분입니다",T("It is 2:30","二時三十分です","两点三十分"),"du si sam-sip bun-im-ni-da")])]),
8:dict(title="요일",decor="월화수목금",topic=T("days of the week","曜日","星期"),sub=T("Days of the week · 요일","曜日 · 요일","星期 · 요일"),scenes=[
 expr(T("DAYS · 요일","曜日 · 요일","星期 · 요일"),"월, 화, 수, 목, 금.","월 화 수 목 금","월:wol 화:hwa 수:su 목:mok 금:geum",
  T("Mon · Tue · Wed · Thu · Fri","月 · 火 · 水 · 木 · 金","周一 · 二 · 三 · 四 · 五"),T("Add 요일 to make a day","요일をつけると曜日","加요일就是星期"),
  T("Add yoil to each one. Wol-yo-il is Monday.","それぞれに、요일をつけます。월요일は月曜日です。","每个字后面加요일。월요일是星期一。"),repeat=True),
 expr(T("TODAY · 오늘","今日 · 오늘","今天 · 오늘"),"오늘은 금요일이에요.","오늘은 금요일이에요.","오:o 늘:neul 은:eun _ 금:geum 요:yo 일:il 이:i 에:e 요:yo",
  T("Today is Friday.","今日は金曜日です。","今天是星期五。"),T("Saying the day","曜日を言う","说星期几"),
  T("Oneul means today. Add ieyo to say is.","오늘は「今日」です。이에요をつけると「です」になります。","오늘是“今天”。加이에요表示“是”。"),
  nt=dict(w="<span class='hl'>오늘은</span>",s="<span class='hl'>오느른</span>",rule=LINK,say="오느른.")),
 build(T("TOMORROW · 내일","明日 · 내일","明天 · 내일"),[card("내일은","nae-i-reun",G['timet'],T("tomorrow","明日は","明天")),card("토요일","to-yo-il",G['noun'],T("Saturday","土曜日","星期六")),card("이에요","i-e-yo",G['cop'],T("is","です","是"))],
  dict(ko="내일은 토요일이에요.",rom="nae-i-reun to-yo-i-ri-e-yo",loc=T("Tomorrow is Saturday.","明日は土曜日です。","明天是星期六。"),say="내일은 토요일이에요."),
  T("Ieyo is the softer polite form of imnida.","이에요は、입니다のやわらかい丁寧形です。","이에요是입니다较柔和的敬语形式。")),
 quiz(T("Today is Friday","今日は金曜日です","今天是星期五"),"오늘은 금요일이에요","o-neu-reun geu-myo-i-ri-e-yo"),
 outro([("월 화 수 목 금",T("Mon to Fri","月〜金","周一到周五"),"wol hwa su mok geum"),("오늘은 금요일이에요",T("Today is Friday","今日は金曜日です","今天是星期五"),"o-neu-reun geu-myo-i-ri-e-yo"),("내일은 토요일이에요",T("Tomorrow is Saturday","明日は土曜日です","明天是星期六"),"nae-i-reun to-yo-i-ri-e-yo")])]),
9:dict(title="주문하기",decor="물커피얼마잔",topic=T("ordering","注文","点餐"),sub=T("Ordering · 주문","注文 · 주문","点餐 · 주문"),scenes=[
 expr(T("ORDER · 주문","注文 · 주문","点餐 · 주문"),"물 주세요.","물 주세요.","물:mul _ 주:ju 세:se 요:yo",
  T("Water, please.","お水をください。","请给我水。"),T("Asking politely","ていねいにお願いする","礼貌地请求"),
  T("Noun plus juseyo means please give me. It works everywhere.","名詞に、주세요をつけると、「ください」です。どこでも使えます。","名词加주세요就是“请给我”。随处都能用。"),repeat=True),
 expr(T("PRICE · 가격","値段 · 가격","价格 · 가격"),"얼마예요?","얼마예요?","얼:eol 마:ma 예:ye 요:yo",
  T("How much is it?","いくらですか？","多少钱？"),T("Asking the price","値段を聞く","询问价格"),
  T("Use it in shops and restaurants. Answers use Sino-Korean numbers.","お店や食堂で使います。答えには漢数詞を使います。","在商店和餐厅使用。回答用汉字词数字。")),
 build(T("ORDER · 주문","注文 · 주문","点餐 · 주문"),[card("커피","keo-pi",G['noun'],T("coffee","コーヒー","咖啡")),card("한 잔","han jan",G['numcnt'],T("one cup","一杯","一杯")),card("주세요","ju-se-yo",G['req'],T("please give","ください","请给我"))],
  dict(ko="커피 한 잔 주세요.",rom="keo-pi han jan ju-se-yo",loc=T("One coffee, please.","コーヒーを一杯ください。","请给我一杯咖啡。"),say="커피 한 잔 주세요."),
  T("Say the item, the amount, then juseyo.","品物、数、주세요の順に言います。","依次说东西、数量，再加주세요。")),
 quiz(T("How much is it?","いくらですか？","多少钱？"),"얼마예요?","eol-ma-ye-yo"),
 outro([("물 주세요",T("Water, please","お水をください","请给我水"),"mul ju-se-yo"),("얼마예요?",T("How much is it?","いくらですか？","多少钱？"),"eol-ma-ye-yo"),("커피 한 잔 주세요",T("One coffee, please","コーヒーを一杯ください","请给我一杯咖啡"),"keo-pi han jan ju-se-yo")])]),
10:dict(title="1급 복습",decor="복습퀴즈일급",topic=T("the Level 1 review","1級の復習","1级复习"),sub=T("Level 1 review · 복습","1級の復習 · 복습","1级复习 · 복습"),scenes=[
 quiz(T("Thank you","ありがとう","谢谢"),"감사합니다","gam-sa-ham-ni-da"),
 quiz(T("I am a student","私は学生です","我是学生"),"저는 학생입니다","jeo-neun hak-ssaeng-im-ni-da"),
 quiz(T("What is this?","これは何ですか？","这是什么？"),"이것은 무엇입니까?","i-geo-seun mu-eo-sim-ni-kka"),
 quiz(T("Where is it?","どこにありますか？","在哪里？"),"어디에 있어요?","eo-di-e iss-eo-yo"),
 quiz(T("One coffee, please","コーヒーを一杯ください","请给我一杯咖啡"),"커피 한 잔 주세요","keo-pi han jan ju-se-yo"),
 outro([("안녕하세요",T("Hello","こんにちは","你好"),"an-nyeong-ha-se-yo"),("감사합니다",T("Thank you","ありがとう","谢谢"),"gam-sa-ham-ni-da"),("커피 한 잔 주세요",T("One coffee, please","コーヒーを一杯ください","请给我一杯咖啡"),"keo-pi han jan ju-se-yo")])])}
LESSONS[10]['bye']=T("Level 1 complete! See you in Level 2.","1級、修了です！2級で会いましょう。","1级完成！我们2级见。")
LESSONS[10]['next']=("TOPIK 2급",T("LEVEL 2","2級","2级"))

# ── 최종 번호 체계: 1강 한글 읽기 · 2강 인사 · 3~10강 (위 데이터는 작성 순서라 여기서 재배열)
_old=LESSONS
LESSONS={3:_old[2],4:_old[3],5:_old[4],6:_old[5],7:_old[6],8:_old[7],9:_old[9],10:_old[10]}
BACKLOG_LEVEL2={'days':_old[8]}   # 요일은 10강 안에 맞추려고 2급으로 이동
S3=lambda x:T(x,x,x)
LESSONS[1]=dict(title="한글 읽기",decor="ㅏㅓㄱㄴ가",topic=T("reading Hangul","ハングルの読み方","认读韩文"),sub=T("Reading Hangul · 한글","ハングルを読もう · 한글","认读韩文 · 한글"),scenes=[
 expr(T("VOWELS · 모음","母音 · 모음","元音 · 모음"),"아, 어, 오, 우, 으, 이.","ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ","ㅏ:a ㅓ:eo ㅗ:o ㅜ:u ㅡ:eu ㅣ:i",
  S3("a · eo · o · u · eu · i"),T("Six basic vowels","基本の母音6つ","6个基本元音"),
  T("Hangul is built from simple shapes. Start with six basic vowels.","ハングルは、簡単な形でできています。まず、基本の母音を六つ。","韩文由简单的形状组成。先学六个基本元音。"),repeat=True),
 expr(T("CONSONANTS · 자음","子音 · 자음","辅音 · 자음"),"가, 나, 다, 마, 사.","ㄱ ㄴ ㄷ ㅁ ㅅ","ㄱ:g ㄴ:n ㄷ:d ㅁ:m ㅅ:s",
  S3("ga · na · da · ma · sa"),T("Consonant + ㅏ","子音 + ㅏ","辅音 + ㅏ"),
  T("Add a consonant to the vowel a, and you can read a sound. Say ga, na, da, ma, sa.","母音のアに子音をつけると、音が読めます。ガ、ナ、ダ、マ、サ。","在元音a前加辅音，就能读出一个音。ga、na、da、ma、sa。")),
 build(T("BLOCKS · 글자","文字 · 글자","字块 · 글자"),[card("ㄱ","gi-yeok",T("CONSONANT","子音","辅音"),S3("g"),say="기역."),card("ㅏ","",T("VOWEL","母音","元音"),S3("a"),say="아."),card("가","",T("SYLLABLE","音節","音节"),S3("ga"),say="가.")],
  dict(ko="나라",rom="na-ra",loc=T("country","国","国家"),say="나라."),
  T("A consonant and a vowel make one block. Now read: na-ra. It means country.","子音と母音で、一つの文字になります。読んでみましょう。ナラ、国という意味です。","辅音和元音组成一个字块。来读一读：na-ra，意思是国家。"),ops=('+','=')),
 quiz(S3("나무"),"na-mu",T("tree","木","树"),say="나무.",ask=T("Can you read this word?","この単語、読めますか？","你能读出这个词吗？"),qlabel=T("READ THIS · 읽어 보세요","読んでみよう · 읽어 보세요","读读看 · 읽어 보세요")),
 outro([("ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ",T("6 vowels","母音6つ","6个元音"),"a eo o u eu i"),("ㄱ ㄴ ㄷ ㅁ ㅅ",T("5 consonants","子音5つ","5个辅音"),"g n d m s"),("가 · 나라",T("Blocks and a word","文字と単語","字块和单词"),"ga · na-ra")])])
LESSONS[2]=dict(title="인사",decor="안녕하세요감사",topic=T("greetings","あいさつ","问候"),sub=T("Greetings · 인사","あいさつ · 인사","问候 · 인사"),scenes=[
 expr(T("HELLO · 인사","こんにちは · 인사","你好 · 인사"),"안녕하세요.","안녕하세요","안:an 녕:nyeong 하:ha 세:se 요:yo",
  T("Hello","こんにちは","你好"),T("Polite · safe with anyone","丁寧 · 誰にでも使える","敬语 · 对谁都可以用"),
  T("It means hello. Use it when you meet someone. It's polite, so it works with anyone.","こんにちは、という意味。会ったときに使う、丁寧な言い方です。","意思是，你好。见面时使用，是敬语，对谁都可以用。"),repeat=True),
 expr(T("THANK YOU · 감사","ありがとう · 감사","谢谢 · 감사"),"감사합니다.","감사합니다","감:gam 사:sa 합:ham 니:ni 다:da",
  T("Thank you","ありがとうございます","谢谢"),T("When someone helps you","助けてもらったとき","别人帮助你的时候"),
  T("It means thank you. Use it when someone helps you.","ありがとう、という意味。助けてもらったときに使います。","意思是，谢谢。别人帮助你时使用。"),
  nt=dict(w="<span class='hl'>합니</span>다",s="<span class='hl'>함니</span>다",rule=T("ㅂ + ㄴ → ㅁ + ㄴ","ㅂ + ㄴ → ㅁ + ㄴ","ㅂ + ㄴ → ㅁ + ㄴ"),say="감사함니다.",
   c=T("Careful: it looks like b, but we say m. Listen.","注意。文字はプですが、ムと発音します。聞いてください。","注意，看起来是b，实际读m。听一听。"))),
 build(T("I AM A STUDENT · 자기소개","私は学生です · 자기소개","我是学生 · 자기소개"),[card("저는","jeo-neun",G['pron'],T("I","私は","我")),card("학생","hak-ssaeng",G['noun'],T("student","学生","学生")),card("입니다","im-ni-da",G['cop'],T("am","です","是"))],
  dict(ko="저는 학생입니다.",rom="jeo-neun hak-ssaeng-im-ni-da",loc=T("I am a student.","私は学生です。","我是学生。"),say="저는 학생입니다."),
  T("Use it to introduce yourself.","自己紹介で使います。","用来做自我介绍。")),
 quiz(T("Thank you","ありがとう","谢谢"),"감사합니다","gam-sa-ham-ni-da"),
 outro([("안녕하세요",T("Hello","こんにちは","你好"),"an-nyeong-ha-se-yo"),("감사합니다",T("Thank you","ありがとう","谢谢"),"gam-sa-ham-ni-da"),("저는 학생입니다",T("I am a student","私は学生です","我是学生"),"jeo-neun hak-ssaeng-im-ni-da")])])
LESSONS=dict(sorted(LESSONS.items()))

# ── 11~20강 (1급 후반) + 10강을 '중간 복습'으로 조정
LESSONS[10].update(title="중간 복습",topic=T("the first review","最初の復習","第一次复习"),sub=T("Review 1 · 복습","復習 1 · 복습","复习 1 · 복습")); LESSONS[10].pop('bye',None); LESSONS[10].pop('next',None)
LESSONS[11]=BACKLOG_LEVEL2['days']
G.update(month=T("MONTH","月","月份"),day=T("DAY","日","日"),topicn=T("NOUN + TOPIC","名詞 + は","名词 + 主题助词"),obj=T("OBJECT + 을/를","目的語 + を","宾语 + 을/를"),
 timew=T("TIME","時","时间"),pastv=T("PAST VERB","過去形","过去式动词"),means=T("MEANS + 로","手段 + 로","方式 + 로"))
def N(w,s,rule,say,c=None):
    d=dict(w=f"<span class='hl'>{w}</span>",s=f"<span class='hl'>{s}</span>",rule=rule,say=say)
    if c: d['c']=c
    return d
SIL=T("Silent ㅎ","ㅎは発音しない","ㅎ不发音"); BM=T("ㅂ + ㄴ → ㅁ + ㄴ","ㅂ + ㄴ → ㅁ + ㄴ","ㅂ + ㄴ → ㅁ + ㄴ")
LESSONS[12]=dict(title="날짜",decor="월일며칠오",topic=T("dates","日付","日期"),sub=T("Dates · 날짜","日付 · 날짜","日期 · 날짜"),scenes=[
 expr(T("MONTHS · 월","月 · 월","月份 · 월"),"일월, 이월, 삼월.","일월 이월 삼월","일:il 월:wol _ 이:i 월:wol _ 삼:sam 월:wol",S3("1 · 2 · 3"),T("Number + 월 = month","数字 + 월 = 月","数字 + 월 = 月份"),
  T("Add wol to a Sino-Korean number to say the month. Careful: June and October are irregular.","漢数詞に、월をつけると月になります。注意。六月と十月は不規則です。","汉字词数字加월就是月份。注意，六月和十月是不规则的。"),repeat=True),
 expr(T("DATE · 날짜","日付 · 날짜","日期 · 날짜"),"오늘은 며칠이에요?","오늘은 며칠이에요?","오:o 늘:neul 은:eun _ 며:myeo 칠:chil 이:i 에:e 요:yo",T("What is the date today?","今日は何日ですか？","今天几号？"),T("Asking the date","日付を聞く","询问日期"),
  T("Myeochil means what day of the month. Answer with a number plus il.","며칠は「何日」です。数字に、일をつけて答えます。","며칠是“几号”。回答时用数字加일。"),nt=N("며칠이","며치리",LINK,"며치리에요.")),
 build(T("TODAY · 오늘","今日 · 오늘","今天 · 오늘"),[card("오월","o-wol",G['month'],T("May","5月","五月")),card("오일","o-il",G['day'],T("the 5th","5日","5号")),card("이에요","i-e-yo",G['cop'],T("is","です","是"))],
  dict(ko="오월 오일이에요.",rom="o-wol o-i-ri-e-yo",loc=T("It is May 5th.","5月5日です。","是五月五号。"),say="오월 오일이에요."),
  T("Month first, then day. Korean dates go from big to small.","月、日の順に言います。韓国語は、大きい単位から言います。","先说月，再说日。韩语的日期从大到小。")),
 quiz(T("What is the date today?","今日は何日ですか？","今天几号？"),"오늘은 며칠이에요?","o-neu-reun myeo-chi-ri-e-yo"),
 outro([("일월 이월 삼월",T("Jan · Feb · Mar","1月 · 2月 · 3月","一月 · 二月 · 三月"),"il-wol i-wol sam-wol"),("오늘은 며칠이에요?",T("What is the date today?","今日は何日ですか？","今天几号？"),"o-neu-reun myeo-chi-ri-e-yo"),("오월 오일이에요",T("It is May 5th","5月5日です","是五月五号"),"o-wol o-i-ri-e-yo")])])
LESSONS[13]=dict(title="가족",decor="아버지어머니가",topic=T("family","家族","家人"),sub=T("Family · 가족","家族 · 가족","家人 · 가족"),scenes=[
 expr(T("FAMILY · 가족","家族 · 가족","家人 · 가족"),"아버지, 어머니.","아버지 어머니","아:a 버:beo 지:ji _ 어:eo 머:meo 니:ni",T("Father · Mother","父 · 母","父亲 · 母亲"),T("Family words","家族の言葉","家人的称呼"),
  T("Father is abeoji and mother is eomeoni. Use them to talk about your parents.","父はアボジ、母はオモニです。両親について話すときに使います。","父亲是아버지，母亲是어머니。谈到父母时使用。"),repeat=True),
 expr(T("COUNT · 명","数える · 명","数人 · 명"),"가족은 네 명이에요.","가족은 네 명이에요.","가:ga 족:jok 은:eun _ 네:ne _ 명:myeong 이:i 에:e 요:yo",T("There are four people in my family.","家族は四人です。","我家有四口人。"),T("Counting people with 명","명で人を数える","用명数人"),
  T("Use native numbers plus myeong to count people. Four becomes ne before a counter.","固有語の数字に、명をつけて人を数えます。四は、ネに変わります。","固有词数字加명来数人。四要变成ne。"),nt=N("가족은","가조근",LINK,"가조근.")),
 build(T("FAMILY · 가족","家族 · 가족","家人 · 가족"),[card("가족은","ga-jo-geun",G['topicn'],T("my family","家族は","家人")),card("세 명","se myeong",G['numcnt'],T("three people","三人","三个人")),card("이에요","i-e-yo",G['cop'],T("is","です","是"))],
  dict(ko="가족은 세 명이에요.",rom="ga-jo-geun se myeong-i-e-yo",loc=T("My family is three people.","家族は三人です。","我家有三口人。"),say="가족은 세 명이에요."),
  T("Native number plus myeong. Three is se here.","固有語の数字 + 명。三は、セです。","固有词数字 + 명。三在这里是se。")),
 quiz(T("mother","母","母亲"),"어머니","eo-meo-ni"),
 outro([("아버지 어머니",T("Father · Mother","父 · 母","父亲 · 母亲"),"a-beo-ji eo-meo-ni"),("가족은 네 명이에요",T("Four people in my family","家族は四人です","我家有四口人"),"ga-jo-geun ne myeong-i-e-yo"),("가족은 세 명이에요",T("Three people in my family","家族は三人です","我家有三口人"),"ga-jo-geun se myeong-i-e-yo")])])
LESSONS[14]=dict(title="음식",decor="김치맛비빔밥",topic=T("food","食べ物","饮食"),sub=T("Food · 음식","食べ物 · 음식","饮食 · 음식"),scenes=[
 expr(T("LIKE · 좋아요","好き · 좋아요","喜欢 · 좋아요"),"김치를 좋아해요.","김치를 좋아해요.","김:gim 치:chi 를:reul _ 좋:jo 아:a 해:hae 요:yo",T("I like kimchi.","キムチが好きです。","我喜欢泡菜。"),T("Saying what you like","好きなものを言う","说出喜欢的东西"),
  T("Noun plus reul, then joahaeyo, means I like it. Reul marks the object.","名詞に、를をつけて、좋아해요と言うと、「好きです」です。를は目的語を表します。","名词加를，再说좋아해요，就是“我喜欢”。를表示宾语。"),repeat=True,nt=N("좋아해요","조아해요",SIL,"조아해요.")),
 expr(T("TASTE · 맛","味 · 맛","味道 · 맛"),"이거 맛있어요.","이거 맛있어요.","이:i 거:geo _ 맛:mat 있:iss 어:eo 요:yo",T("This is delicious.","これはおいしいです。","这个很好吃。"),T("Praising food","料理をほめる","夸奖食物"),
  T("Masisseoyo means it is delicious. Say it after you taste.","맛있어요は「おいしいです」です。食べた後に言いましょう。","맛있어요的意思是“很好吃”。吃过之后说。"),nt=N("맛있어요","마시써요",T("Linking + hard sound","連音 + 濃い音","连读 + 紧音"),"마시써요.")),
 build(T("EAT · 먹어요","食べる · 먹어요","吃 · 먹어요"),[card("저는","jeo-neun",G['pron'],T("I","私は","我")),card("비빔밥을","bi-bim-ba-beul",G['obj'],T("bibimbap","ビビンバ","拌饭")),card("먹어요","meo-geo-yo",G['verb'],T("eat","食べます","吃"))],
  dict(ko="저는 비빔밥을 먹어요.",rom="jeo-neun bi-bim-ba-beul meo-geo-yo",loc=T("I eat bibimbap.","私はビビンバを食べます。","我吃拌饭。"),say="저는 비빔밥을 먹어요."),
  T("Subject, object, verb. The verb always comes last.","主語、目的語、動詞の順です。動詞は最後に来ます。","主语、宾语、动词。动词总是放在最后。")),
 quiz(T("I like kimchi","キムチが好きです","我喜欢泡菜"),"김치를 좋아해요","gim-chi-reul jo-a-hae-yo"),
 outro([("김치를 좋아해요",T("I like kimchi","キムチが好きです","我喜欢泡菜"),"gim-chi-reul jo-a-hae-yo"),("이거 맛있어요",T("This is delicious","これはおいしいです","这个很好吃"),"i-geo ma-si-sseo-yo"),("저는 비빔밥을 먹어요",T("I eat bibimbap","私はビビンバを食べます","我吃拌饭"),"jeo-neun bi-bim-ba-beul meo-geo-yo")])])
LESSONS[15]=dict(title="일상",decor="공부해요하루",topic=T("daily life","日常","日常生活"),sub=T("Daily life · 일상","日常 · 일상","日常 · 일상"),scenes=[
 expr(T("VERB · 하다","動詞 · 하다","动词 · 하다"),"공부해요.","공부해요","공:gong 부:bu 해:hae 요:yo",T("I study.","勉強します。","我学习。"),T("Noun + 하다 = verb","名詞 + 하다 = 動詞","名词 + 하다 = 动词"),
  T("Add haeyo to a noun to make a verb. Gongbu means study.","名詞に、해요をつけると動詞になります。공부は「勉強」です。","名词加해요就变成动词。공부是“学习”。"),repeat=True),
 expr(T("ASK · 질문","質問 · 질문","提问 · 질문"),"무엇을 해요?","무엇을 해요?","무:mu 엇:eo 을:eul _ 해:hae 요:yo",T("What are you doing?","何をしていますか？","你在做什么？"),T("Asking what someone does","何をするか聞く","询问对方在做什么"),
  T("Mueoseul means what. Use it to ask what someone does.","무엇을は「何を」です。相手が何をするか聞くときに使います。","무엇을是“什么”。用来询问对方做什么。"),nt=N("무엇을","무어슬",LINK,"무어슬.")),
 build(T("STUDY · 공부","勉強 · 공부","学习 · 공부"),[card("저는","jeo-neun",G['pron'],T("I","私は","我")),card("한국어를","han-gu-geo-reul",G['obj'],T("Korean","韓国語","韩语")),card("공부해요","gong-bu-hae-yo",G['verb'],T("study","勉強します","学习"))],
  dict(ko="저는 한국어를 공부해요.",rom="jeo-neun han-gu-geo-reul gong-bu-hae-yo",loc=T("I study Korean.","私は韓国語を勉強します。","我学习韩语。"),say="저는 한국어를 공부해요."),
  T("Swap the object to say what else you do.","目的語を変えれば、ほかのことも言えます。","替换宾语，就能说其他事情。")),
 quiz(T("I study","勉強します","我学习"),"공부해요","gong-bu-hae-yo"),
 outro([("공부해요",T("I study","勉強します","我学习"),"gong-bu-hae-yo"),("무엇을 해요?",T("What are you doing?","何をしていますか？","你在做什么？"),"mu-eo-seul hae-yo"),("저는 한국어를 공부해요",T("I study Korean","私は韓国語を勉強します","我学习韩语"),"jeo-neun han-gu-geo-reul gong-bu-hae-yo")])])
LESSONS[16]=dict(title="과거형",decor="어제갔어요먹",topic=T("the past tense","過去形","过去时"),sub=T("Past tense · 과거형","過去形 · 과거형","过去时 · 과거형"),scenes=[
 expr(T("PAST · 어제","過去 · 어제","过去 · 어제"),"어제 학교에 갔어요.","어제 학교에 갔어요.","어:eo 제:je _ 학:hak 교:gyo 에:e _ 갔:gat 어:eo 요:yo",T("I went to school yesterday.","昨日、学校に行きました。","我昨天去了学校。"),T("Past: ~았어요 / ~었어요","過去: ~았어요 / ~었어요","过去：~았어요 / ~었어요"),
  T("Yesterday is eoje. Add ass or eoss to the verb to make it past.","어제は「昨日」です。動詞に、았か었をつけると過去になります。","어제是“昨天”。动词加았或었就变成过去时。"),repeat=True,nt=N("갔어요","가써요",LINK,"가써요.")),
 expr(T("ASK · 질문","質問 · 질문","提问 · 질문"),"뭐 먹었어요?","뭐 먹었어요?","뭐:mwo _ 먹:meok 었:eot 어:eo 요:yo",T("What did you eat?","何を食べましたか？","你吃了什么？"),T("Asking about the past","過去のことを聞く","询问过去的事"),
  T("Mwo means what. Meogeosseoyo means ate.","뭐は「何」です。먹었어요は「食べました」です。","뭐是“什么”。먹었어요是“吃了”。"),nt=N("먹었어요","머거써요",LINK,"머거써요.")),
 build(T("YESTERDAY · 어제","昨日 · 어제","昨天 · 어제"),[card("어제","eo-je",G['timew'],T("yesterday","昨日","昨天")),card("커피를","keo-pi-reul",G['obj'],T("coffee","コーヒー","咖啡")),card("마셨어요","ma-syeo-sseo-yo",G['pastv'],T("drank","飲みました","喝了"))],
  dict(ko="어제 커피를 마셨어요.",rom="eo-je keo-pi-reul ma-syeo-sseo-yo",loc=T("I drank coffee yesterday.","昨日、コーヒーを飲みました。","我昨天喝了咖啡。"),say="어제 커피를 마셨어요."),
  T("Time, object, past verb. Easy to build.","時間、目的語、過去形の動詞の順です。","时间、宾语、过去式动词，很容易组合。")),
 quiz(T("What did you eat?","何を食べましたか？","你吃了什么？"),"뭐 먹었어요?","mwo meo-geo-sseo-yo"),
 outro([("어제 학교에 갔어요",T("I went to school yesterday","昨日、学校に行きました","我昨天去了学校"),"eo-je hak-gyo-e ga-sseo-yo"),("뭐 먹었어요?",T("What did you eat?","何を食べましたか？","你吃了什么？"),"mwo meo-geo-sseo-yo"),("어제 커피를 마셨어요",T("I drank coffee yesterday","昨日、コーヒーを飲みました","我昨天喝了咖啡"),"eo-je keo-pi-reul ma-syeo-sseo-yo")])])
LESSONS[17]=dict(title="쇼핑",decor="비싸요깎아좀",topic=T("shopping","買い物","购物"),sub=T("Shopping · 쇼핑","買い物 · 쇼핑","购物 · 쇼핑"),scenes=[
 expr(T("PRICE · 가격","値段 · 가격","价格 · 가격"),"이거 비싸요.","이거 비싸요.","이:i 거:geo _ 비:bi 싸:ssa 요:yo",T("This is expensive.","これは高いです。","这个很贵。"),T("Describing things","ものの様子を言う","描述东西"),
  T("Bissayo means expensive. Cheap is ssayo.","비싸요は「高いです」です。安いは、싸요です。","비싸요是“贵”。便宜是싸요。"),repeat=True),
 expr(T("BARGAIN · 흥정","値切る · 흥정","讲价 · 흥정"),"좀 깎아 주세요.","좀 깎아 주세요.","좀:jom _ 깎:kkak 아:a _ 주:ju 세:se 요:yo",T("Please give me a discount.","少し安くしてください。","请便宜一点。"),T("Bargaining politely","ていねいに値切る","礼貌地讲价"),
  T("Kkakka juseyo means please lower the price. Jom makes it softer.","깎아 주세요は「安くしてください」です。좀をつけると、やわらかくなります。","깎아 주세요的意思是“请降价”。加좀语气更委婉。"),nt=N("깎아","까까",LINK,"까까.")),
 build(T("BUY · 사기","買う · 사기","购买 · 사기"),[card("이거","i-geo",G['noun'],T("this","これ","这个")),card("하나","ha-na",G['number'],T("one","一つ","一个")),card("주세요","ju-se-yo",G['req'],T("please give","ください","请给我"))],
  dict(ko="이거 하나 주세요.",rom="i-geo ha-na ju-se-yo",loc=T("One of these, please.","これを一つください。","请给我一个这个。"),say="이거 하나 주세요."),
  T("Point, say the number, then juseyo. It works in any shop.","指さして、数を言って、주세요。どの店でも使えます。","指着东西，说数量，再加주세요。在任何商店都管用。")),
 quiz(T("It is expensive","高いです","很贵"),"비싸요","bi-ssa-yo"),
 outro([("이거 비싸요",T("This is expensive","これは高いです","这个很贵"),"i-geo bi-ssa-yo"),("좀 깎아 주세요",T("Please give me a discount","少し安くしてください","请便宜一点"),"jom kka-kka ju-se-yo"),("이거 하나 주세요",T("One of these, please","これを一つください","请给我一个这个"),"i-geo ha-na ju-se-yo")])])
LESSONS[18]=dict(title="교통",decor="지하철버스서울",topic=T("transportation","交通","交通"),sub=T("Transportation · 교통","交通 · 교통","交通 · 교통"),scenes=[
 expr(T("RIDE · 타요","乗る · 타요","乘坐 · 타요"),"지하철을 타요.","지하철을 타요.","지:ji 하:ha 철:cheol 을:eul _ 타:ta 요:yo",T("I take the subway.","地下鉄に乗ります。","我坐地铁。"),T("Taking transport","乗り物に乗る","乘坐交通工具"),
  T("Jihacheol is the subway. Tayo means ride, and reul comes before it.","지하철は「地下鉄」です。타요は「乗ります」で、前に를をつけます。","지하철是“地铁”。타요是“乘坐”，前面加를。"),repeat=True,nt=N("지하철을","지하처를",LINK,"지하처를.")),
 expr(T("GO · 가요","行く · 가요","去 · 가요"),"서울역에 가요.","서울역에 가요.","서:seo 울:ul 역:yeok 에:e _ 가:ga 요:yo",T("I go to Seoul Station.","ソウル駅に行きます。","我去首尔站。"),T("Place + 에 가요","場所 + 에 가요","地点 + 에 가요"),
  T("Place plus e plus gayo means go to.","場所に、에をつけて、가요と言うと、「〜に行きます」です。","地点加에，再说가요，就是“去…”。")),
 build(T("BY BUS · 버스","バスで · 버스","坐公交 · 버스"),[card("저는","jeo-neun",G['pron'],T("I","私は","我")),card("버스로","beo-seu-ro",G['means'],T("by bus","バスで","坐公交车")),card("가요","ga-yo",G['verb'],T("go","行きます","去"))],
  dict(ko="저는 버스로 가요.",rom="jeo-neun beo-seu-ro ga-yo",loc=T("I go by bus.","私はバスで行きます。","我坐公交车去。"),say="저는 버스로 가요."),
  T("Add ro to a vehicle to say how you go.","乗り物に、로をつけると、手段を表せます。","在交通工具后加로，表示乘坐的方式。")),
 quiz(T("I go to Seoul Station","ソウル駅に行きます","我去首尔站"),"서울역에 가요","seo-ul-yeo-ge ga-yo"),
 outro([("지하철을 타요",T("I take the subway","地下鉄に乗ります","我坐地铁"),"ji-ha-cheo-reul ta-yo"),("서울역에 가요",T("I go to Seoul Station","ソウル駅に行きます","我去首尔站"),"seo-ul-yeo-ge ga-yo"),("저는 버스로 가요",T("I go by bus","私はバスで行きます","我坐公交车去"),"jeo-neun beo-seu-ro ga-yo")])])
LESSONS[19]=dict(title="사과와 부탁",decor="죄송괜찮도와",topic=T("apologies and requests","謝罪とお願い","道歉和请求"),sub=T("Sorry and please · 사과 부탁","謝罪とお願い · 사과 부탁","道歉和请求 · 사과 부탁"),scenes=[
 expr(T("SORRY · 사과","謝罪 · 사과","道歉 · 사과"),"죄송합니다.","죄송합니다","죄:joe 송:song 합:ham 니:ni 다:da",T("I am sorry.","申し訳ありません。","对不起。"),T("Apologizing","謝る","道歉"),
  T("Use it to apologize. It ends just like gamsahamnida.","謝るときに使います。감사합니다と同じ語尾です。","用来道歉。结尾和감사합니다一样。"),repeat=True,nt=N("합니","함니",BM,"죄송함니다.")),
 expr(T("OKAY · 괜찮아요","大丈夫 · 괜찮아요","没关系 · 괜찮아요"),"괜찮아요.","괜찮아요","괜:gwaen 찮:chan 아:a 요:yo",T("It is okay.","大丈夫です。","没关系。"),T("Reassuring someone","相手を安心させる","安慰对方"),
  T("It means it is okay, no problem. It is also the usual answer to sorry.","「大丈夫です」という意味です。謝られたときの返事にも使います。","意思是“没关系”。也是回应道歉的常用说法。"),nt=N("괜찮아요","괜차나요",SIL,"괜차나요.")),
 build(T("HELP · 부탁","お願い · 부탁","请求 · 부탁"),[card("저를","jeo-reul",G['obj'],T("me","私を","我")),card("도와","do-wa",G['verb'],T("help","助けて","帮助")),card("주세요","ju-se-yo",G['req'],T("please give","ください","请给我"))],
  dict(ko="저를 도와 주세요.",rom="jeo-reul do-wa ju-se-yo",loc=T("Please help me.","私を助けてください。","请帮帮我。"),say="저를 도와 주세요."),
  T("Use it when you need help. Everyone will understand.","助けが必要なときに使います。誰にでも通じます。","需要帮助时使用，谁都能听懂。")),
 quiz(T("It is okay","大丈夫です","没关系"),"괜찮아요","gwaen-cha-na-yo"),
 outro([("죄송합니다",T("I am sorry","申し訳ありません","对不起"),"joe-song-ham-ni-da"),("괜찮아요",T("It is okay","大丈夫です","没关系"),"gwaen-cha-na-yo"),("저를 도와 주세요",T("Please help me","私を助けてください","请帮帮我"),"jeo-reul do-wa ju-se-yo")])])
LESSONS[20]=dict(title="1급 종합 복습",decor="종합복습끝일",topic=T("the final Level 1 review","1級の総復習","1级总复习"),sub=T("Level 1 final review · 종합 복습","1級の総復習 · 종합 복습","1级总复习 · 종합 복습"),scenes=[
 quiz(T("What is the date today?","今日は何日ですか？","今天几号？"),"오늘은 며칠이에요?","o-neu-reun myeo-chi-ri-e-yo"),
 quiz(T("I like kimchi","キムチが好きです","我喜欢泡菜"),"김치를 좋아해요","gim-chi-reul jo-a-hae-yo"),
 quiz(T("What did you eat?","何を食べましたか？","你吃了什么？"),"뭐 먹었어요?","mwo meo-geo-sseo-yo"),
 quiz(T("It is expensive","高いです","很贵"),"비싸요","bi-ssa-yo"),
 quiz(T("I go to Seoul Station","ソウル駅に行きます","我去首尔站"),"서울역에 가요","seo-ul-yeo-ge ga-yo"),
 outro([("김치를 좋아해요",T("I like kimchi","キムチが好きです","我喜欢泡菜"),"gim-chi-reul jo-a-hae-yo"),("서울역에 가요",T("I go to Seoul Station","ソウル駅に行きます","我去首尔站"),"seo-ul-yeo-ge ga-yo"),("괜찮아요",T("It is okay","大丈夫です","没关系"),"gwaen-cha-na-yo")])])
LESSONS[20]['bye']=T("Level 1 complete! See you in Level 2.","1級、修了です！2級で会いましょう。","1级完成！我们2级见。")
LESSONS[20]['next']=("TOPIK 2급",T("LEVEL 2","2級","2级"))
LESSONS=dict(sorted(LESSONS.items()))
