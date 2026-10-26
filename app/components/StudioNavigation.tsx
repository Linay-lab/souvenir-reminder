"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";

const pages = [
  {href:"/dashboard-preview",label:"旅行",symbol:"✈"},
  {href:"/",label:"清單",symbol:"▣"},
  {href:"/collections",label:"收藏",symbol:"♡"},
  {href:"/itinerary",label:"行程",symbol:"▦"},
  {href:"/wallet",label:"錢包",symbol:"◈"},
  {href:"/profile",label:"我的",symbol:"◉"},
];
export default function StudioNavigation(){
 const path=usePathname();
 return <>
  <nav aria-label="旅購網站導覽" className="studio-top-nav mx-auto hidden max-w-6xl flex-wrap items-center gap-2 px-4 py-3 md:flex">
   <Link href="/dashboard-preview" className="mr-3 text-base font-bold text-[#34423D]">✈ 旅購 <span className="text-xs font-normal">Travel Studio</span></Link>
   {pages.map(p=><Link key={p.href} href={p.href} aria-current={path===p.href?"page":undefined} className={`rounded-full px-4 py-2 text-sm transition ${path===p.href?"bg-[#34423D] text-white":"text-[#52645a] hover:bg-[#e7eee8]"}`}>{p.label}</Link>)}
  </nav>
  <nav aria-label="旅購手機導覽" className="studio-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-[#e4e6de] bg-[#FAF9F6]/95 px-1 py-2 text-center text-[11px] font-medium text-[#52645a] shadow-lg backdrop-blur md:hidden">
   {pages.map(p=><Link key={p.href} href={p.href} aria-current={path===p.href?"page":undefined} className={`rounded-xl px-1 py-1 ${path===p.href?"bg-[#e7eee8] font-bold text-[#34423D]":""}`}><span className="block text-lg">{p.symbol}</span>{p.label}</Link>)}
  </nav>
 </>;
}
