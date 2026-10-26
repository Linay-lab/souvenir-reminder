import Link from "next/link";
const tasks=[
 {n:"01",title:"建立一趟旅行",desc:"先建立自己的旅行，填入目的地與日期。",href:"/dashboard-preview#my-trips"},
 {n:"02",title:"試著收藏一個東西",desc:"可以是商品、景點或美食，試著填上照片或來源網址。",href:"/collections"},
 {n:"03",title:"把收藏加入旅行",desc:"商品可加入購物清單；景點或美食可選日期加入行程。",href:"/collections"},
 {n:"04",title:"安排一筆行程與花費",desc:"試試每日行程及旅行錢包的新增、編輯與刪除。",href:"/itinerary"},
 {n:"05",title:"告訴我們你的感受",desc:"遇到問題、覺得不好用或有新點子，都歡迎回報。",href:"/feedback"}
];
export default function BetaGuide(){return <main className="min-h-screen bg-[#FAF9F6] px-4 pb-16 pt-8 text-[#34423D] sm:px-8"><div className="mx-auto max-w-3xl"><Link href="/dashboard-preview" className="text-sm font-semibold text-[#527586]">← 返回旅購</Link><p className="mt-9 text-xs font-semibold tracking-[.22em] text-[#789995]">TRAVEL STUDIO · BETA</p><h1 className="mt-2 text-3xl font-bold">歡迎來試玩旅購 ✈️</h1><p className="mt-4 text-sm leading-7 text-[#718078]">旅購是一個讓你在旅行前收藏想買的東西、想去的地方，再慢慢安排旅行的小工具。這是測試版本，邀請你用自己的方式探索，不用每個功能都試完。</p>
 <section className="mt-6 rounded-3xl border border-[#dce7df] bg-[#edf1ec] p-5"><h2 className="font-bold">測試前先知道</h2><p className="mt-2 text-sm leading-7">請使用自己的測試帳號，不要共用帳號。這是 Beta 版本，功能與資料格式仍可能調整，請不要上傳證件、信用卡或其他敏感資料。照片收藏使用公開圖片網址，請只上傳願意公開的照片。</p><p className="mt-2 text-sm leading-7">如果新增收藏、行程或支出時出現「資料表尚未啟用」，代表測試環境尚未完成設定；請回報問題，不必重複提交。</p></section>
 <h2 className="mt-8 text-xl font-bold">推薦你試試這 5 件事</h2><div className="mt-4 space-y-3">{tasks.map(t=><Link key={t.n} href={t.href} className="flex gap-4 rounded-2xl border border-[#e4e8e0] bg-white p-5 shadow-sm"><span className="text-lg font-bold text-[#95aba0]">{t.n}</span><div><h3 className="font-bold">{t.title}</h3><p className="mt-1 text-sm leading-6 text-[#74827b]">{t.desc}</p></div><span className="ml-auto text-[#80958a]">→</span></Link>)}</div>
 <Link href="/feedback" className="mt-8 block rounded-2xl bg-[#a5ad96] px-5 py-4 text-center font-bold text-white">💌 提交使用回饋</Link><p className="mt-5 text-center text-xs text-[#859188]">感謝你幫旅購一起成長。</p></div></main>}
