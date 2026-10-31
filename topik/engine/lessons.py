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
