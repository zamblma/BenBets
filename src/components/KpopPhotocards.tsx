import { useState, useMemo, useEffect, useRef, type CSSProperties } from 'react';
import { Medal, Package, BookOpen, Star, Search, Sparkles, Crown, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlacedBet, PokemonCard } from '../types';
import { fetchWikiThumbnails } from '../utils/wikiImages';
import { getCachedCommonsGalleries, preloadIdolGalleries } from '../utils/kpopMedia';
import { useSound } from '../hooks/useSound';

interface MemberSeed {
  name: string;
  enWiki?: string;
  koWiki?: string;
  commonsQuery: string;
}

interface GroupSeed {
  name: string;
  era: string;
  wiki: string;
  accent: string;
  members: MemberSeed[];
}

export interface IdolDef {
  id: string;
  name: string;
  groupName: string;
  era: string;
  accent: string;
  groupWiki: string;
  enWiki?: string;
  koWiki?: string;
  commonsQuery: string;
}

const GROUPS: GroupSeed[] = [
  {
    name: 'BTS',
    era: 'Proof / GOLDEN',
    wiki: 'BTS',
    accent: 'bg-purple-600',
    members: [
      { name: 'RM', enWiki: 'RM_(rapper)', koWiki: 'RM_(래퍼)', commonsQuery: 'RM BTS' },
      { name: 'Jin', enWiki: 'Jin_(singer)', koWiki: '진_(가수)', commonsQuery: 'Jin BTS Kim Seok-jin' },
      { name: 'Suga', enWiki: 'Suga_(rapper)', koWiki: '슈가_(래퍼)', commonsQuery: 'Suga BTS Min Yoon-gi' },
      { name: 'J-Hope', enWiki: 'J-Hope', koWiki: '제이홉', commonsQuery: 'J-Hope BTS' },
      { name: 'Jimin', enWiki: 'Jimin', koWiki: '지민_(1995년)', commonsQuery: 'Jimin BTS Park Ji-min' },
      { name: 'V', enWiki: 'V_(singer)', koWiki: '뷔', commonsQuery: 'V Kim Tae-hyung BTS' },
      { name: 'Jungkook', enWiki: 'Jungkook', koWiki: '정국', commonsQuery: 'Jungkook BTS' },
    ],
  },
  {
    name: 'BLACKPINK',
    era: 'BORN PINK',
    wiki: 'Blackpink',
    accent: 'bg-pink-600',
    members: [
      { name: 'Jisoo', enWiki: 'Jisoo', koWiki: '지수_(1995년)', commonsQuery: 'Jisoo Blackpink Kim Ji-soo' },
      { name: 'Jennie', enWiki: 'Jennie_(singer)', koWiki: '제니_(가수)', commonsQuery: 'Jennie Kim Blackpink' },
      { name: 'Rosé', enWiki: 'Rosé_(singer)', koWiki: '로제_(가수)', commonsQuery: 'Rosé Blackpink' },
      { name: 'Lisa', enWiki: 'Lisa_(rapper)', koWiki: '리사_(1997년)', commonsQuery: 'Lisa Blackpink Lalisa' },
    ],
  },
  {
    name: 'TWICE',
    era: 'STRATEGY',
    wiki: 'Twice',
    accent: 'bg-rose-500',
    members: [
      { name: 'Nayeon', enWiki: 'Nayeon', koWiki: '나연_(가수)', commonsQuery: 'Im Nayeon Twice' },
      { name: 'Jeongyeon', enWiki: 'Jeongyeon', koWiki: '정연_(가수)', commonsQuery: 'Yoo Jeong-yeon Twice' },
      { name: 'Momo', enWiki: 'Momo_(singer)', koWiki: '모모_(가수)', commonsQuery: 'Hirai Momo Twice' },
      { name: 'Sana', enWiki: 'Sana_(singer)', koWiki: '사나_(가수)', commonsQuery: 'Minatozaki Sana Twice' },
      { name: 'Jihyo', enWiki: 'Jihyo', koWiki: '지효', commonsQuery: 'Park Ji-hyo Twice' },
      { name: 'Mina', enWiki: 'Mina_(Japanese_singer)', koWiki: '미나_(1997년)', commonsQuery: 'Myoui Mina Twice' },
      { name: 'Dahyun', enWiki: 'Dahyun', koWiki: '다현', commonsQuery: 'Kim Da-hyun Twice' },
      { name: 'Chaeyoung', enWiki: 'Chaeyoung', koWiki: '채영', commonsQuery: 'Son Chae-young Twice' },
      { name: 'Tzuyu', enWiki: 'Tzuyu', koWiki: '쯔위', commonsQuery: 'Chou Tzuyu Twice' },
    ],
  },
  {
    name: 'NewJeans',
    era: 'Supernatural / Get Up',
    wiki: 'NewJeans',
    accent: 'bg-sky-500',
    members: [
      { name: 'Minji', enWiki: 'Minji_(singer)', koWiki: '민지_(2004년)', commonsQuery: 'Minji NewJeans Kim Min-ji' },
      { name: 'Hanni', enWiki: 'Hanni_(singer)', koWiki: '하니_(2004년)', commonsQuery: 'Hanni Pham NewJeans' },
      { name: 'Danielle', enWiki: 'Danielle_(singer)', koWiki: '다니엘_(2005년)', commonsQuery: 'Danielle Marsh NewJeans' },
      { name: 'Haerin', enWiki: 'Haerin', koWiki: '해린_(가수)', commonsQuery: 'Haerin NewJeans Kang Hae-rin' },
      { name: 'Hyein', enWiki: 'Hyein', koWiki: '혜인', commonsQuery: 'Hyein NewJeans Lee Hye-in' },
    ],
  },
  {
    name: 'Stray Kids',
    era: 'ATE / HOP',
    wiki: 'Stray_Kids',
    accent: 'bg-red-600',
    members: [
      { name: 'Bang Chan', enWiki: 'Bang_Chan', koWiki: '방찬', commonsQuery: 'Bang Chan Stray Kids' },
      { name: 'Lee Know', enWiki: 'Lee_Know', koWiki: '리노_(가수)', commonsQuery: 'Lee Know Stray Kids' },
      { name: 'Changbin', enWiki: 'Changbin', koWiki: '창빈', commonsQuery: 'Seo Changbin Stray Kids' },
      { name: 'Hyunjin', enWiki: 'Hyunjin', koWiki: '현진_(가수)', commonsQuery: 'Hwang Hyunjin Stray Kids' },
      { name: 'Han', enWiki: 'Han_(rapper)', koWiki: '한_(가수)', commonsQuery: 'Han Jisung Stray Kids' },
      { name: 'Felix', enWiki: 'Felix_(rapper)', koWiki: '필릭스_(가수)', commonsQuery: 'Felix Lee Stray Kids' },
      { name: 'Seungmin', enWiki: 'Seungmin', koWiki: '승민', commonsQuery: 'Kim Seungmin Stray Kids' },
      { name: 'I.N', enWiki: 'I.N', koWiki: '아이엔', commonsQuery: 'I.N Yang Jeong-in Stray Kids' },
    ],
  },
  {
    name: '(G)I-DLE',
    era: 'I SWAY / 2',
    wiki: '(G)I-dle',
    accent: 'bg-fuchsia-600',
    members: [
      { name: 'Soyeon', enWiki: 'Jeon_So-yeon', koWiki: '전소연', commonsQuery: 'Jeon So-yeon (G)I-DLE' },
      { name: 'Miyeon', enWiki: 'Cho_Mi-yeon', koWiki: '미연', commonsQuery: 'Cho Mi-yeon (G)I-DLE' },
      { name: 'Minnie', enWiki: 'Minnie_(singer)', koWiki: '민니', commonsQuery: 'Minnie Nicha Yontararak (G)I-DLE' },
      { name: 'Yuqi', enWiki: 'Song_Yuqi', koWiki: '우기_(가수)', commonsQuery: 'Song Yuqi (G)I-DLE' },
      { name: 'Shuhua', enWiki: 'Yeh_Shu-hua', koWiki: '슈화', commonsQuery: 'Yeh Shu-hua (G)I-DLE' },
    ],
  },
  {
    name: 'LE SSERAFIM',
    era: 'CRAZY / HOT',
    wiki: 'Le_Sserafim',
    accent: 'bg-indigo-600',
    members: [
      { name: 'Sakura', enWiki: 'Sakura_Miyawaki', koWiki: '미야와키_사쿠라', commonsQuery: 'Miyawaki Sakura LE SSERAFIM' },
      { name: 'Kim Chaewon', enWiki: 'Kim_Chae-won_(singer,_born_2000)', koWiki: '김채원_(2000년)', commonsQuery: 'Kim Chaewon LE SSERAFIM' },
      { name: 'Huh Yunjin', enWiki: 'Huh_Yun-jin', koWiki: '허윤진', commonsQuery: 'Huh Yunjin LE SSERAFIM' },
      { name: 'Kazuha', enWiki: 'Kazuha_(singer)', koWiki: '카즈하', commonsQuery: 'Nakamura Kazuha LE SSERAFIM' },
      { name: 'Hong Eunchae', enWiki: 'Hong_Eun-chae', koWiki: '홍은채', commonsQuery: 'Hong Eunchae LE SSERAFIM' },
    ],
  },
  {
    name: 'aespa',
    era: 'Whiplash / Supernova',
    wiki: 'Aespa',
    accent: 'bg-violet-600',
    members: [
      { name: 'Karina', enWiki: 'Karina_(South_Korean_singer)', koWiki: '카리나_(가수)', commonsQuery: 'Karina aespa Yu Ji-min' },
      { name: 'Winter', enWiki: 'Winter_(singer)', koWiki: '윈터_(가수)', commonsQuery: 'Winter aespa Kim Min-jeong' },
      { name: 'Giselle', enWiki: 'Giselle_(singer)', koWiki: '지젤_(가수)', commonsQuery: 'Giselle aespa Uchinaga Aeri' },
      { name: 'Ningning', enWiki: 'Ningning', koWiki: '닝닝', commonsQuery: 'Ningning aespa Ning Yizhuo' },
    ],
  },
  {
    name: 'ENHYPEN',
    era: 'ROMANCE : UNTOLD',
    wiki: 'Enhypen',
    accent: 'bg-amber-600',
    members: [
      { name: 'Jungwon', enWiki: 'Yang_Jung-won', koWiki: '양정원', commonsQuery: 'Yang Jungwon ENHYPEN' },
      { name: 'Heeseung', enWiki: 'Heeseung', koWiki: '희승', commonsQuery: 'Lee Heeseung ENHYPEN' },
      { name: 'Jay', enWiki: 'Jay_(singer,_born_2002)', koWiki: '제이_(2002년)', commonsQuery: 'Jay Park Jong-seong ENHYPEN' },
      { name: 'Jake', enWiki: 'Jake_(singer)', koWiki: '제이크_(가수)', commonsQuery: 'Jake Sim Jae-yun ENHYPEN' },
      { name: 'Sunghoon', enWiki: 'Park_Sung-hoon_(singer)', koWiki: '성훈_(가수)', commonsQuery: 'Park Sunghoon ENHYPEN' },
      { name: 'Sunoo', enWiki: 'Sunoo', koWiki: '선우_(2003년)', commonsQuery: 'Kim Sunoo ENHYPEN' },
      { name: 'Ni-ki', enWiki: 'Ni-ki', koWiki: '니키_(가수)', commonsQuery: 'Ni-ki Nishimura Riki ENHYPEN' },
    ],
  },
  {
    name: 'ITZY',
    era: 'GOLD',
    wiki: 'Itzy',
    accent: 'bg-pink-500',
    members: [
      { name: 'Yeji', enWiki: 'Hwang_Ye-ji', koWiki: '예지_(가수)', commonsQuery: 'Hwang Yeji ITZY' },
      { name: 'Lia', enWiki: 'Lia_(singer)', koWiki: '리아_(가수)', commonsQuery: 'Lia Choi Jisu ITZY' },
      { name: 'Ryujin', enWiki: 'Shin_Ryu-jin', koWiki: '류진', commonsQuery: 'Shin Ryujin ITZY' },
      { name: 'Chaeryeong', enWiki: 'Lee_Chae-ryeong', koWiki: '채령', commonsQuery: 'Lee Chaeryeong ITZY' },
      { name: 'Yuna', enWiki: 'Shin_Yu-na', koWiki: '유나_(2003년)', commonsQuery: 'Shin Yuna ITZY' },
    ],
  },
  {
    name: 'SEVENTEEN',
    era: 'SPILL THE FEELS',
    wiki: 'Seventeen_(South_Korean_band)',
    accent: 'bg-cyan-600',
    members: [
      { name: 'S.Coups', enWiki: 'S.Coups', koWiki: '에스쿱스', commonsQuery: 'S.Coups SEVENTEEN' },
      { name: 'Jeonghan', enWiki: 'Jeonghan', koWiki: '정한_(가수)', commonsQuery: 'Yoon Jeonghan SEVENTEEN' },
      { name: 'Joshua', enWiki: 'Joshua_(singer)', koWiki: '조슈아_(1995년)', commonsQuery: 'Joshua Hong SEVENTEEN' },
      { name: 'Jun', enWiki: 'Wen_Junhui', koWiki: '준_(1996년)', commonsQuery: 'Wen Junhui SEVENTEEN' },
      { name: 'Hoshi', enWiki: 'Hoshi_(singer)', koWiki: '호시', commonsQuery: 'Hoshi Kwon Soonyoung SEVENTEEN' },
      { name: 'Wonwoo', enWiki: 'Wonwoo', koWiki: '원우', commonsQuery: 'Jeon Wonwoo SEVENTEEN' },
      { name: 'Woozi', enWiki: 'Woozi', koWiki: '우지_(가수)', commonsQuery: 'Woozi Lee Jihoon SEVENTEEN' },
      { name: 'DK', enWiki: 'DK_(singer)', koWiki: '도겸', commonsQuery: 'DK Lee Seokmin SEVENTEEN' },
      { name: 'Mingyu', enWiki: 'Kim_Min-gyu_(singer)', koWiki: '민규_(1997년)', commonsQuery: 'Kim Mingyu SEVENTEEN' },
      { name: 'The8', enWiki: 'The8', koWiki: '디에잇', commonsQuery: 'The8 Xu Minghao SEVENTEEN' },
      { name: 'Seungkwan', enWiki: 'Seungkwan', koWiki: '부승관', commonsQuery: 'Boo Seungkwan SEVENTEEN' },
      { name: 'Vernon', enWiki: 'Vernon_(rapper)', koWiki: '버논_(가수)', commonsQuery: 'Vernon Chwe SEVENTEEN' },
      { name: 'Dino', enWiki: 'Dino_(South_Korean_singer)', koWiki: '디노_(가수)', commonsQuery: 'Dino Lee Chan SEVENTEEN' },
    ],
  },
  {
    name: 'NCT 127',
    era: 'WALK',
    wiki: 'NCT_127',
    accent: 'bg-lime-600',
    members: [
      { name: 'Taeil', enWiki: 'Taeil_(singer,_born_1994)', koWiki: '태일_(1994년)', commonsQuery: 'Moon Taeil NCT' },
      { name: 'Johnny', enWiki: 'Johnny_(singer)', koWiki: '쟈니_(가수)', commonsQuery: 'Johnny Suh NCT 127' },
      { name: 'Taeyong', enWiki: 'Taeyong', koWiki: '태용', commonsQuery: 'Lee Taeyong NCT' },
      { name: 'Yuta', enWiki: 'Yuta_Nakamoto', koWiki: '유타_(가수)', commonsQuery: 'Nakamoto Yuta NCT 127' },
      { name: 'Doyoung', enWiki: 'Doyoung_(singer)', koWiki: '도영', commonsQuery: 'Kim Doyoung NCT' },
      { name: 'Jaehyun', enWiki: 'Jaehyun_(singer)', koWiki: '재현_(1997년)', commonsQuery: 'Jung Jaehyun NCT' },
      { name: 'Jungwoo', enWiki: 'Kim_Jung-woo_(singer)', koWiki: '정우_(1998년)', commonsQuery: 'Kim Jungwoo NCT' },
      { name: 'Mark', enWiki: 'Mark_Lee_(singer)', koWiki: '마크_(1999년)', commonsQuery: 'Mark Lee NCT' },
      { name: 'Haechan', enWiki: 'Haechan', koWiki: '해찬', commonsQuery: 'Haechan Lee Dong-hyuck NCT' },
    ],
  },
  {
    name: 'EXO',
    era: 'EXIST',
    wiki: 'Exo',
    accent: 'bg-slate-600',
    members: [
      { name: 'Suho', enWiki: 'Suho_(singer)', koWiki: '수호_(가수)', commonsQuery: 'Suho Kim Jun-myeon EXO' },
      { name: 'Xiumin', enWiki: 'Xiumin', koWiki: '시우민', commonsQuery: 'Xiumin Kim Min-seok EXO' },
      { name: 'Baekhyun', enWiki: 'Baekhyun', koWiki: '백현', commonsQuery: 'Byun Baekhyun EXO' },
      { name: 'Chen', enWiki: 'Chen_(singer)', koWiki: '첸_(가수)', commonsQuery: 'Chen Kim Jong-dae EXO' },
      { name: 'Chanyeol', enWiki: 'Chanyeol', koWiki: '찬열', commonsQuery: 'Park Chanyeol EXO' },
      { name: 'D.O.', enWiki: 'D.O._(entertainer)', koWiki: '디오_(가수)', commonsQuery: 'Doh Kyung-soo D.O EXO' },
      { name: 'Kai', enWiki: 'Kai_(entertainer)', koWiki: '카이_(가수)', commonsQuery: 'Kai Kim Jong-in EXO' },
      { name: 'Sehun', enWiki: 'Sehun', koWiki: '세훈', commonsQuery: 'Oh Sehun EXO' },
    ],
  },
  {
    name: 'Red Velvet',
    era: 'Cosmic',
    wiki: 'Red_Velvet_(group)',
    accent: 'bg-red-500',
    members: [
      { name: 'Irene', enWiki: 'Irene_(singer)', koWiki: '아이린_(가수)', commonsQuery: 'Irene Bae Joo-hyun Red Velvet' },
      { name: 'Seulgi', enWiki: 'Seulgi', koWiki: '슬기_(가수)', commonsQuery: 'Kang Seulgi Red Velvet' },
      { name: 'Wendy', enWiki: 'Wendy_(singer)', koWiki: '웬디_(가수)', commonsQuery: 'Wendy Son Seung-wan Red Velvet' },
      { name: 'Joy', enWiki: 'Joy_(singer)', koWiki: '조이_(가수)', commonsQuery: 'Joy Park Soo-young Red Velvet' },
      { name: 'Yeri', enWiki: 'Yeri_(singer)', koWiki: '예리_(가수)', commonsQuery: 'Yeri Kim Ye-rim Red Velvet' },
    ],
  },
  {
    name: 'MAMAMOO',
    era: 'MIC ON',
    wiki: 'Mamamoo',
    accent: 'bg-emerald-600',
    members: [
      { name: 'Solar', enWiki: 'Solar_(singer)', koWiki: '솔라_(가수)', commonsQuery: 'Solar Kim Yong-sun MAMAMOO' },
      { name: 'Moonbyul', enWiki: 'Moonbyul', koWiki: '문별', commonsQuery: 'Moonbyul MAMAMOO' },
      { name: 'Wheein', enWiki: 'Wheein', koWiki: '휘인', commonsQuery: 'Jung Wheein MAMAMOO' },
      { name: 'Hwasa', enWiki: 'Hwasa', koWiki: '화사', commonsQuery: 'Hwasa Ahn Hye-jin MAMAMOO' },
    ],
  },
  {
    name: 'IVE',
    era: 'IVE SWITCH',
    wiki: 'Ive_(group)',
    accent: 'bg-blue-600',
    members: [
      { name: 'Yujin', enWiki: 'An_Yu-jin', koWiki: '안유진', commonsQuery: 'An Yu-jin IVE' },
      { name: 'Gaeul', enWiki: 'Gaeul', koWiki: '가을_(가수)', commonsQuery: 'Gaeul Kim Ga-eul IVE' },
      { name: 'Rei', enWiki: 'Rei_(singer)', koWiki: '레이_(2004년)', commonsQuery: 'Naoi Rei IVE' },
      { name: 'Wonyoung', enWiki: 'Jang_Won-young', koWiki: '장원영', commonsQuery: 'Jang Won-young IVE' },
      { name: 'Liz', enWiki: 'Liz_(singer)', koWiki: '리즈_(가수)', commonsQuery: 'Liz Kim Ji-won IVE' },
      { name: 'Leeseo', enWiki: 'Leeseo', koWiki: '이서_(가수)', commonsQuery: 'Leeseo Lee Hyun-seo IVE' },
    ],
  },
  {
    name: 'ATEEZ',
    era: 'GOLDEN HOUR',
    wiki: 'Ateez',
    accent: 'bg-orange-600',
    members: [
      { name: 'Hongjoong', enWiki: 'Kim_Hong-joong', koWiki: '홍중', commonsQuery: 'Kim Hongjoong ATEEZ' },
      { name: 'Seonghwa', enWiki: 'Seonghwa', koWiki: '성화_(가수)', commonsQuery: 'Park Seonghwa ATEEZ' },
      { name: 'Yunho', enWiki: 'Jeong_Yun-ho_(singer)', koWiki: '윤호_(1999년)', commonsQuery: 'Jeong Yunho ATEEZ' },
      { name: 'Yeosang', enWiki: 'Kang_Yeo-sang', koWiki: '여상', commonsQuery: 'Kang Yeosang ATEEZ' },
      { name: 'San', enWiki: 'Choi_San', koWiki: '산_(가수)', commonsQuery: 'Choi San ATEEZ' },
      { name: 'Mingi', enWiki: 'Song_Min-gi', koWiki: '민기_(1999년)', commonsQuery: 'Song Mingi ATEEZ' },
      { name: 'Wooyoung', enWiki: 'Jung_Woo-young', koWiki: '우영_(1999년)', commonsQuery: 'Jung Wooyoung ATEEZ' },
      { name: 'Jongho', enWiki: 'Choi_Jong-ho', koWiki: '종호', commonsQuery: 'Choi Jongho ATEEZ' },
    ],
  },
  {
    name: 'Dreamcatcher',
    era: 'VirtuouS',
    wiki: 'Dreamcatcher_(group)',
    accent: 'bg-rose-700',
    members: [
      { name: 'JiU', enWiki: 'JiU', koWiki: '지유_(1994년)', commonsQuery: 'Kim Min-ji JiU Dreamcatcher' },
      { name: 'SuA', enWiki: 'SuA_(singer)', koWiki: '수아_(1994년)', commonsQuery: 'Kim Bo-ra SuA Dreamcatcher' },
      { name: 'Siyeon', enWiki: 'Lee_Si-yeon_(singer)', koWiki: '시연_(1995년)', commonsQuery: 'Lee Si-yeon Dreamcatcher' },
      { name: 'Handong', enWiki: 'Handong_(singer)', koWiki: '한동_(가수)', commonsQuery: 'Handong Dreamcatcher' },
      { name: 'Yoohyeon', enWiki: 'Yoohyeon', koWiki: '유현_(가수)', commonsQuery: 'Kim Yoohyeon Dreamcatcher' },
      { name: 'Dami', enWiki: 'Dami_(singer)', koWiki: '다미', commonsQuery: 'Lee Yu-bin Dami Dreamcatcher' },
      { name: 'Gahyeon', enWiki: 'Gahyeon', koWiki: '가현', commonsQuery: 'Lee Gahyeon Dreamcatcher' },
    ],
  },
  {
    name: 'ZEROBASEONE',
    era: 'CINEMA PARADISE',
    wiki: 'Zerobaseone',
    accent: 'bg-teal-600',
    members: [
      { name: 'Zhang Hao', enWiki: 'Zhang_Hao_(singer)', koWiki: '장하오', commonsQuery: 'Zhang Hao ZEROBASEONE' },
      { name: 'Sung Hanbin', enWiki: 'Sung_Han-bin', koWiki: '성한빈', commonsQuery: 'Sung Hanbin ZEROBASEONE' },
      { name: 'Matthew', enWiki: 'Seok_Matthew', koWiki: '석매튜', commonsQuery: 'Seok Matthew ZEROBASEONE' },
      { name: 'Taerae', enWiki: 'Kim_Tae-rae', koWiki: '김태래', commonsQuery: 'Kim Taerae ZEROBASEONE' },
      { name: 'Ricky', enWiki: 'Ricky_(singer)', koWiki: '리키_(2004년)', commonsQuery: 'Ricky Shen Quanrui ZEROBASEONE' },
      { name: 'Gyuvin', enWiki: 'Kim_Gyu-vin', koWiki: '김규빈', commonsQuery: 'Kim Gyuvin ZEROBASEONE' },
      { name: 'Gunwook', enWiki: 'Park_Gun-wook', koWiki: '박건욱', commonsQuery: 'Park Gunwook ZEROBASEONE' },
      { name: 'Yujin', enWiki: 'Han_Yu-jin', koWiki: '한유진', commonsQuery: 'Han Yujin ZEROBASEONE' },
      { name: 'Jiwoong', enWiki: 'Kim_Ji-woong', koWiki: '김지웅', commonsQuery: 'Kim Jiwoong ZEROBASEONE' },
    ],
  },
  {
    name: 'RIIZE',
    era: 'RIIZING',
    wiki: 'Riize',
    accent: 'bg-amber-500',
    members: [
      { name: 'Shotaro', enWiki: 'Shotaro_(singer)', koWiki: '쇼타로_(가수)', commonsQuery: 'Shotaro Osaki RIIZE' },
      { name: 'Eunseok', enWiki: 'Eunseok', koWiki: '은석', commonsQuery: 'Song Eunseok RIIZE' },
      { name: 'Sungchan', enWiki: 'Sungchan', koWiki: '성찬_(가수)', commonsQuery: 'Jung Sungchan RIIZE' },
      { name: 'Wonbin', enWiki: 'Wonbin_(singer)', koWiki: '원빈_(가수)', commonsQuery: 'Park Wonbin RIIZE' },
      { name: 'Seunghan', enWiki: 'Seunghan', koWiki: '승한', commonsQuery: 'Hong Seunghan RIIZE' },
      { name: 'Sohee', enWiki: 'Sohee_(singer)', koWiki: '소희_(2003년)', commonsQuery: 'Lee Sohee RIIZE' },
      { name: 'Anton', enWiki: 'Anton_(singer)', koWiki: '앤톤_(가수)', commonsQuery: 'Anton Lee Chanyoung RIIZE' },
    ],
  },
  {
    name: 'BABYMONSTER',
    era: 'DRIP',
    wiki: 'Babymonster',
    accent: 'bg-red-600',
    members: [
      { name: 'Ruka', enWiki: 'Ruka_(singer)', koWiki: '루카_(가수)', commonsQuery: 'Ruka Kawai BABYMONSTER' },
      { name: 'Pharita', enWiki: 'Pharita', koWiki: '파리타', commonsQuery: 'Pharita BABYMONSTER' },
      { name: 'Asa', enWiki: 'Asa_(singer)', koWiki: '아사_(가수)', commonsQuery: 'Asa Enami BABYMONSTER' },
      { name: 'Ahyeon', enWiki: 'Ahyeon', koWiki: '아현_(2007년)', commonsQuery: 'Ahyeon Jung BABYMONSTER' },
      { name: 'Rami', enWiki: 'Rami_(singer)', koWiki: '라미_(2007년)', commonsQuery: 'Rami Shin Haram BABYMONSTER' },
      { name: 'Rora', enWiki: 'Rora_(singer)', koWiki: '로라_(가수)', commonsQuery: 'Rora Lee Dain BABYMONSTER' },
      { name: 'Chiquita', enWiki: 'Chiquita_(singer)', koWiki: '치키타_(가수)', commonsQuery: 'Chiquita BABYMONSTER' },
    ],
  },
  {
    name: 'ILLIT',
    era: 'SUPER REAL ME',
    wiki: 'Illit',
    accent: 'bg-pink-400',
    members: [
      { name: 'Yunah', enWiki: 'Yunah', koWiki: '윤아_(2004년)', commonsQuery: 'Noh Yunah ILLIT' },
      { name: 'Minju', enWiki: 'Minju_(singer,_born_2004)', koWiki: '민주_(2004년)', commonsQuery: 'Park Minju ILLIT' },
      { name: 'Moka', enWiki: 'Moka_(singer)', koWiki: '모카_(가수)', commonsQuery: 'Sakai Moka ILLIT' },
      { name: 'Wonhee', enWiki: 'Wonhee', koWiki: '원희', commonsQuery: 'Lee Wonhee ILLIT' },
      { name: 'Iroha', enWiki: 'Iroha_(singer)', koWiki: '이로하', commonsQuery: 'Hokazono Iroha ILLIT' },
    ],
  },
  {
    name: 'KISS OF LIFE',
    era: 'Lose Yourself',
    wiki: 'Kiss_of_Life_(group)',
    accent: 'bg-fuchsia-500',
    members: [
      { name: 'Julie', enWiki: 'Julie_(singer)', koWiki: '줄리_(2000년)', commonsQuery: 'Julie Han KISS OF LIFE' },
      { name: 'Natty', enWiki: 'Natty_(singer)', koWiki: '나띠', commonsQuery: 'Natty KISS OF LIFE' },
      { name: 'Belle', enWiki: 'Belle_(singer)', koWiki: '벨_(가수)', commonsQuery: 'Belle Shim Hyewon KISS OF LIFE' },
      { name: 'Haneul', enWiki: 'Haneul', koWiki: '하늘_(2005년)', commonsQuery: 'Won Haneul KISS OF LIFE' },
    ],
  },
];

const ALL_MEMBERS: IdolDef[] = GROUPS.flatMap((g) =>
  g.members.map((m) => ({
    id: `${g.name}-${m.name}`.replace(/[^a-zA-Z0-9]/g, '_'),
    name: m.name,
    groupName: g.name,
    era: g.era,
    accent: g.accent,
    groupWiki: g.wiki,
    enWiki: m.enWiki,
    koWiki: m.koWiki,
    commonsQuery: m.commonsQuery,
  }))
);

const MEMBER_BY_ID = new Map(ALL_MEMBERS.map((m) => [m.id, m]));
const GROUP_BY_NAME = new Map(GROUPS.map((g) => [g.name, g]));

function getBaseMemberId(cardId: string): string {
  return cardId.split('__')[0];
}

interface RarityInfo {
  lvl: number;
  code: string;
  label: string;
  shortTag: string;
  textCls: string;
  borderCls: string;
  glow: string;
  sellPrice: number;
}

const RARITIES: RarityInfo[] = [
  {
    lvl: 0,
    code: 'Album PC',
    label: 'Album PC',
    shortTag: 'ALBUM PC',
    textCls: 'text-slate-300',
    borderCls: 'border-slate-600/80',
    glow: 'rgba(148,163,184,0.18)',
    sellPrice: 2.5,
  },
  {
    lvl: 1,
    code: 'POB',
    label: 'Pre-Order POB',
    shortTag: 'WEVERSE POB',
    textCls: 'text-cyan-300',
    borderCls: 'border-cyan-400/75 shadow-[0_0_12px_rgba(34,211,238,0.28)]',
    glow: 'rgba(34,211,238,0.32)',
    sellPrice: 11.0,
  },
  {
    lvl: 2,
    code: 'Lucky Draw',
    label: 'Lucky Draw Holo',
    shortTag: 'LUCKY DRAW HOLO',
    textCls: 'text-pink-300',
    borderCls: 'border-pink-400/85 shadow-[0_0_16px_rgba(236,72,153,0.45)]',
    glow: 'rgba(236,72,153,0.45)',
    sellPrice: 42.0,
  },
  {
    lvl: 3,
    code: 'Broadcast',
    label: 'Broadcast Inkigayo',
    shortTag: '🎥 BROADCAST /100',
    textCls: 'text-amber-300',
    borderCls: 'border-amber-400 shadow-[0_0_22px_rgba(251,191,36,0.6)] shimmer-gold',
    glow: 'rgba(251,191,36,0.55)',
    sellPrice: 165.0,
  },
  {
    lvl: 4,
    code: 'Polaroid 1/1',
    label: 'Polaroid Assinada 1/1',
    shortTag: '★ 1/1 POLAROID',
    textCls: 'text-fuchsia-300',
    borderCls: 'border-white/95 shadow-[0_0_28px_rgba(244,114,182,0.75)] shimmer-rainbow',
    glow: 'rgba(244,114,182,0.68)',
    sellPrice: 750.0,
  },
];

function getRarityLevel(rarity: string): number {
  if (rarity === 'Polaroid 1/1') return 4;
  if (rarity === 'Broadcast' || rarity === 'Ultra Rare') return 3;
  if (rarity === 'Lucky Draw' || rarity === 'Rare') return 2;
  if (rarity === 'POB' || rarity === 'Uncommon') return 1;
  return 0;
}

function getRarityInfo(rarity: string): RarityInfo {
  return RARITIES[getRarityLevel(rarity)] || RARITIES[0];
}

interface PackModeDef {
  id: 'standard' | 'comeback' | 'luckydraw';
  name: string;
  subtitle: string;
  price: number;
  multiPrice?: number;
  count: number;
  multiCount?: number;
  icon: string;
  weights: number[];
  bonusSlotWeights?: number[];
  accentBorder: string;
  badgeText: string;
}

const PACK_MODES: PackModeDef[] = [
  {
    id: 'standard',
    name: 'Álbum Standard',
    subtitle: '4 photocards clássicos de comeback',
    price: 19.90,
    count: 4,
    icon: '💿',
    weights: [0.58, 0.275, 0.11, 0.03, 0.005],
    accentBorder: 'border-cyan-500/45',
    badgeText: '0,5% Polaroid 1/1',
  },
  {
    id: 'comeback',
    name: 'Weverse Comeback Box',
    subtitle: '5 cartas • 5ª garantida Lucky Draw+ (3% Polaroid)',
    price: 49.90,
    count: 5,
    icon: '🎀',
    weights: [0.38, 0.40, 0.16, 0.05, 0.01],
    bonusSlotWeights: [0, 0, 0.76, 0.21, 0.03],
    accentBorder: 'border-pink-500/50',
    badgeText: '3% Polaroid no Slot+5',
  },
  {
    id: 'luckydraw',
    name: 'Máquina Lucky Draw Seul',
    subtitle: '0% Album PC • Hard Pity Polaroid 1/1 em 50 giros',
    price: 34.90,
    multiPrice: 169.90,
    count: 1,
    multiCount: 5,
    icon: '🎰',
    weights: [0, 0.64, 0.265, 0.09, 0.005],
    accentBorder: 'border-fuchsia-500/60',
    badgeText: 'PITY 50 • SEM COMUM',
  },
];

const LUCKY_DRAW_PITY_LIMIT = 50;

function rollWeightedRarity(weights: number[]): number {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (r < cum) return i;
  }
  return weights.length - 1;
}

function KpopCardImage({
  card,
  commonsMap,
  koThumbs,
  enThumbs,
  groupThumbs,
  className,
}: {
  card: PokemonCard;
  commonsMap: Record<string, string[]>;
  koThumbs: Record<string, string>;
  enThumbs: Record<string, string>;
  groupThumbs: Record<string, string>;
  className?: string;
}) {
  const member = MEMBER_BY_ID.get(getBaseMemberId(card.id));
  const lvl = getRarityLevel(card.rarity);

  const candidates = useMemo(() => {
    const list: string[] = [];
    if (member) {
      const gallery = commonsMap[member.id];
      if (Array.isArray(gallery) && gallery.length > 0) {
        const preferredIdx = lvl % gallery.length;
        list.push(gallery[preferredIdx]);
        for (let i = 0; i < gallery.length; i++) {
          if (i !== preferredIdx) list.push(gallery[i]);
        }
      }
      if (member.koWiki && koThumbs[member.koWiki]) {
        list.push(koThumbs[member.koWiki]);
      }
      if (member.enWiki && enThumbs[member.enWiki]) {
        list.push(enThumbs[member.enWiki]);
      }
    }
    if (card.imageUrl) list.push(card.imageUrl);
    if (member?.groupWiki && groupThumbs[member.groupWiki]) {
      list.push(groupThumbs[member.groupWiki]);
    } else {
      const grp = GROUP_BY_NAME.get(card.setName);
      if (grp && groupThumbs[grp.wiki]) list.push(groupThumbs[grp.wiki]);
    }

    const seen = new Set<string>();
    return list.filter((u) => {
      if (!u || !u.startsWith('https://') || seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  }, [member, lvl, commonsMap, koThumbs, enThumbs, card.imageUrl, card.setName, groupThumbs]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [card.id, card.imageUrl, candidates.length]);

  if (idx >= candidates.length) {
    return (
      <div className={`w-full h-full ${member?.accent || 'bg-pink-600'} flex flex-col items-center justify-center p-2 text-center`}>
        <span className="text-3xl font-black text-white/90 drop-shadow">{card.name[0]}</span>
        <span className="text-[8px] font-mono text-white/80 uppercase tracking-widest mt-1">{card.setName}</span>
      </div>
    );
  }

  return (
    <img
      src={candidates[idx]}
      alt={card.name}
      className={className}
      loading="lazy"
      onError={() => setIdx((prev) => prev + 1)}
    />
  );
}

export default function KpopPhotocards({
  balance,
  onUpdateBalance,
  onAddBetHistory,
  userId,
  collection,
  onCollectionUpdate,
  onSellCard,
  onSellAllDuplicates,
}: {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
  userId: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
  onSellCard: (cardId: string, price: number) => void;
  onSellAllDuplicates: (prices: Record<string, number>) => void;
}) {
  const pityStorageKey = `benbets_kpop_pity_${userId || 'guest'}`;

  const [tab, setTab] = useState<'gacha' | 'binder'>('gacha');
  const [selectedMode, setSelectedMode] = useState<PackModeDef>(PACK_MODES[2]);
  const [biasGroup, setBiasGroup] = useState<string>('ALL');

  const [packResult, setPackResult] = useState<PokemonCard[]>([]);
  const [opening, setOpening] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [revealingIndex, setRevealingIndex] = useState(-1);
  const [ownedSnapshot, setOwnedSnapshot] = useState<Set<string>>(new Set());

  const [filterRarity, setFilterRarity] = useState('todas');
  const [filterGroup, setFilterGroup] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');

  const skipRef = useRef(false);
  const skipHandledRef = useRef(false);
  const lastRollRef = useRef<{ mode: PackModeDef; qty: number }>({ mode: PACK_MODES[2], qty: 1 });
  const { play } = useSound();

  // Estados de APIs de imagem gratuitas (Wikimedia Commons + Ko/En Wikipedia)
  const [commonsMap, setCommonsMap] = useState<Record<string, string[]>>(() => getCachedCommonsGalleries());
  const [groupThumbs, setGroupThumbs] = useState<Record<string, string>>({});
  const [enThumbs, setEnThumbs] = useState<Record<string, string>>({});
  const [koThumbs, setKoThumbs] = useState<Record<string, string>>({});

  // Pity persistente da Máquina Lucky Draw
  const [polaroidPity, setPolaroidPity] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(pityStorageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.polaroidPity === 'number') return p.polaroidPity;
      }
    } catch {}
    return 0;
  });

  const [totalCapsules, setTotalCapsules] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(pityStorageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.totalCapsules === 'number') return p.totalCapsules;
      }
    } catch {}
    return 0;
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(pityStorageKey);
      if (raw) {
        const p = JSON.parse(raw);
        setPolaroidPity(typeof p.polaroidPity === 'number' ? p.polaroidPity : 0);
        setTotalCapsules(typeof p.totalCapsules === 'number' ? p.totalCapsules : 0);
      } else {
        setPolaroidPity(0);
        setTotalCapsules(0);
      }
    } catch {}
  }, [pityStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(pityStorageKey, JSON.stringify({ polaroidPity, totalCapsules }));
    } catch {}
  }, [pityStorageKey, polaroidPity, totalCapsules]);

  // Carregar retratos individuais das Wikipedias (EN + KO) com filtro anti-foto-de-grupo
  useEffect(() => {
    let cancelled = false;

    const groupTitles = GROUPS.map((g) => g.wiki);
    const enTitles = ALL_MEMBERS.map((m) => m.enWiki).filter((x): x is string => Boolean(x));
    const koTitles = ALL_MEMBERS.map((m) => m.koWiki).filter((x): x is string => Boolean(x));

    Promise.all([
      fetchWikiThumbnails(groupTitles, 550, 'kpop_groups_v2', 'en'),
      fetchWikiThumbnails(enTitles, 600, 'kpop_idols_en_v2', 'en'),
      fetchWikiThumbnails(koTitles, 600, 'kpop_idols_ko_v2', 'ko'),
    ]).then(([grpMap, rawEnMap, koMap]) => {
      if (cancelled) return;
      const groupUrls = new Set(Object.values(grpMap));
      const cleanEnMap: Record<string, string> = {};
      for (const m of ALL_MEMBERS) {
        if (!m.enWiki) continue;
        const url = rawEnMap[m.enWiki];
        if (url && url !== grpMap[m.groupWiki] && !groupUrls.has(url)) {
          cleanEnMap[m.enWiki] = url;
        }
      }
      setGroupThumbs(grpMap);
      setEnThumbs(cleanEnMap);
      setKoThumbs(koMap);
    });

    // Pré-aquecer Commons para vitrine de Graals
    const showcaseIdols = ['BLACKPINK-Jennie', 'aespa-Karina', 'IVE-Wonyoung', 'BTS-Jungkook', 'NewJeans-Hanni']
      .map((id) => MEMBER_BY_ID.get(id))
      .filter((x): x is IdolDef => Boolean(x));
    preloadIdolGalleries(showcaseIdols, 1500).then((res) => {
      if (!cancelled && Object.keys(res).length > 0) {
        setCommonsMap((prev) => ({ ...prev, ...res }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Pré-aquecer galeria Commons ao escolher Grupo Bias
  useEffect(() => {
    if (biasGroup === 'ALL') return;
    const members = ALL_MEMBERS.filter((m) => m.groupName === biasGroup);
    if (members.length === 0) return;
    let cancelled = false;
    preloadIdolGalleries(members, 1800).then((res) => {
      if (!cancelled && Object.keys(res).length > 0) {
        setCommonsMap((prev) => ({ ...prev, ...res }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [biasGroup]);

  const pickMember = (): IdolDef => {
    if (biasGroup !== 'ALL' && Math.random() < 0.5) {
      const biasPool = ALL_MEMBERS.filter((m) => m.groupName === biasGroup);
      if (biasPool.length > 0) {
        return biasPool[Math.floor(Math.random() * biasPool.length)];
      }
    }
    return ALL_MEMBERS[Math.floor(Math.random() * ALL_MEMBERS.length)];
  };

  const handleOpen = async (mode: PackModeDef, pullMultiplier: 1 | 5 = 1, fromOverlay = false) => {
    const isStillRevealing = opening && revealingIndex < packResult.length - 1;
    if (loadingPhotos || isStillRevealing || (opening && !fromOverlay)) return;

    const cost = pullMultiplier === 5 && mode.multiPrice ? mode.multiPrice : mode.price;
    const totalCards = pullMultiplier === 5 && mode.multiCount ? mode.multiCount : mode.count;

    if (balance < cost) {
      alert('Saldo insuficiente');
      return;
    }

    lastRollRef.current = { mode, qty: pullMultiplier };
    play('packOpen');
    onUpdateBalance(-cost);
    setOwnedSnapshot(new Set(collection.map((c) => c.id)));
    setLoadingPhotos(true);
    setOpening(true);
    setPackResult([]);
    setRevealingIndex(-1);
    skipRef.current = false;
    skipHandledRef.current = false;

    const drawnSpecs: { member: IdolDef; rarityLvl: number }[] = [];
    let nextPity = polaroidPity;

    for (let i = 0; i < totalCards; i++) {
      const member = pickMember();
      let rarityLvl = 0;

      if (mode.id === 'luckydraw') {
        nextPity += 1;
        if (nextPity >= LUCKY_DRAW_PITY_LIMIT) {
          rarityLvl = 4;
          nextPity = 0;
        } else {
          rarityLvl = rollWeightedRarity(mode.weights);
          if (rarityLvl === 4) nextPity = 0;
        }
      } else {
        const isBonusSlot = mode.bonusSlotWeights && i === totalCards - 1;
        rarityLvl = rollWeightedRarity(isBonusSlot ? mode.bonusSlotWeights! : mode.weights);
      }

      drawnSpecs.push({ member, rarityLvl });
    }

    if (mode.id === 'luckydraw') {
      setPolaroidPity(nextPity);
      setTotalCapsules((prev) => prev + totalCards);
    }

    // Buscar fotos verticais no Wikimedia Commons para cada idol sorteada antes da revelação
    const freshCommons = await preloadIdolGalleries(
      drawnSpecs.map((s) => s.member),
      950
    );
    const mergedCommons = { ...commonsMap, ...freshCommons };
    if (Object.keys(freshCommons).length > 0) {
      setCommonsMap(mergedCommons);
    }

    const cards: PokemonCard[] = drawnSpecs.map(({ member, rarityLvl }) => {
      const rarityMeta = RARITIES[rarityLvl] || RARITIES[0];
      const gallery = mergedCommons[member.id];
      const photoUrl =
        (Array.isArray(gallery) && gallery.length > 0 ? gallery[rarityLvl % gallery.length] : '') ||
        (member.koWiki ? koThumbs[member.koWiki] : '') ||
        (member.enWiki ? enThumbs[member.enWiki] : '') ||
        groupThumbs[member.groupWiki] ||
        '';

      return {
        id: `${member.id}__r${rarityLvl}`,
        name: member.name,
        imageUrl: photoUrl,
        rarity: rarityMeta.code,
        setName: member.groupName,
        setSeries: member.era,
        quantity: 1,
      };
    });

    setLoadingPhotos(false);
    setPackResult(cards);

    if (onAddBetHistory) {
      const maxLvl = Math.max(...cards.map((c) => getRarityLevel(c.rarity)));
      const topCard = cards.find((c) => getRarityLevel(c.rarity) === maxLvl) || cards[0];
      onAddBetHistory({
        id: `kpop-${Date.now()}`,
        matchName: `K-pop — ${mode.name}`,
        selectionName: `${cards.length}× photocards (Destaque: ${topCard.name})`,
        odds: 0,
        stake: cost,
        potentialPayout: maxLvl >= 3 ? getRarityInfo(topCard.rarity).sellPrice : 0,
        status: 'won',
        placedAt: new Date().toLocaleTimeString('pt-BR'),
        type: 'casino',
        outcomeValue: maxLvl === 4 ? 'POLAROID 1/1!' : maxLvl === 3 ? 'BROADCAST!' : maxLvl === 2 ? 'LUCKY DRAW!' : 'ABERTO',
      });
    }

    const stepDelay = cards.length === 1 ? 260 : 310;
    for (let i = 0; i < cards.length; i++) {
      await new Promise((r) => setTimeout(r, stepDelay));
      if (skipRef.current) break;
      setRevealingIndex(i);
      const lvl = getRarityLevel(cards[i].rarity);
      play(lvl >= 3 ? 'legendary' : lvl === 2 ? 'rare' : 'cardFlip');
    }
    if (!skipRef.current) onCollectionUpdate(cards);
  };

  const handleSellAll = () => {
    const prices: Record<string, number> = {};
    for (const c of collection) {
      if (c.quantity > 1) prices[c.id] = getRarityInfo(c.rarity).sellPrice;
    }
    if (Object.keys(prices).length === 0) return;
    onSellAllDuplicates(prices);
    play('cashout');
  };

  const totalMembers = ALL_MEMBERS.length;
  const uniqueIdolCount = useMemo(
    () => new Set(collection.map((c) => getBaseMemberId(c.id))).size,
    [collection]
  );
  const progress = Math.round((uniqueIdolCount / totalMembers) * 100);

  const grailStats = useMemo(() => {
    let polaroids = 0;
    let broadcasts = 0;
    let totalDuplicateValue = 0;
    for (const c of collection) {
      const lvl = getRarityLevel(c.rarity);
      if (lvl === 4) polaroids += c.quantity;
      if (lvl === 3) broadcasts += c.quantity;
      if (c.quantity > 1) totalDuplicateValue += (c.quantity - 1) * getRarityInfo(c.rarity).sellPrice;
    }
    return { polaroids, broadcasts, totalDuplicateValue };
  }, [collection]);

  const groupedCollection = useMemo(() => {
    const groups: Record<string, PokemonCard[]> = {};
    const filtered = collection.filter((c) => {
      if (filterRarity !== 'todas' && getRarityLevel(c.rarity) !== parseInt(filterRarity, 10)) return false;
      if (filterGroup !== 'todos' && c.setName !== filterGroup) return false;
      if (
        searchQuery &&
        !c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.setName.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    for (const card of filtered) {
      (groups[card.setName] ??= []).push(card);
    }

    for (const arr of Object.values(groups)) {
      arr.sort((a, b) => getRarityLevel(b.rarity) - getRarityLevel(a.rarity));
    }

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [collection, filterRarity, filterGroup, searchQuery]);

  const renderShowcasePreviewCard = (idolId: string, lvl: number) => {
    const m = MEMBER_BY_ID.get(idolId);
    if (!m) return null;
    const meta = RARITIES[lvl];
    const mockCard: PokemonCard = {
      id: `${m.id}__r${lvl}`,
      name: m.name,
      imageUrl: '',
      rarity: meta.code,
      setName: m.groupName,
      setSeries: m.era,
      quantity: 1,
    };
    const isPolaroid = lvl === 4;
    return (
      <div
        key={`${idolId}-${lvl}`}
        className={`rounded-xl overflow-hidden transition-transform hover:scale-[1.03] relative ${
          isPolaroid
            ? 'bg-gradient-to-b from-white via-pink-50 to-fuchsia-100 p-1.5 border-2 border-white shadow-[0_0_24px_rgba(244,114,182,0.5)] shimmer-rainbow'
            : `bg-[#070910] border-2 ${meta.borderCls}`
        }`}
      >
        <div className="aspect-[2/3] relative overflow-hidden rounded-lg bg-[#06070d]">
          <KpopCardImage
            card={mockCard}
            commonsMap={commonsMap}
            koThumbs={koThumbs}
            enThumbs={enThumbs}
            groupThumbs={groupThumbs}
            className="w-full h-full object-cover object-top"
          />
          <span
            className={`absolute top-1.5 left-1.5 text-[7px] font-black px-1.5 py-0.5 rounded ${
              isPolaroid ? 'bg-fuchsia-600 text-white' : 'bg-black/80 text-amber-300 border border-amber-400/40'
            }`}
          >
            {meta.shortTag}
          </span>
        </div>
        <div className={`pt-1.5 pb-1 px-1 text-center ${isPolaroid ? 'text-slate-900' : 'text-white'}`}>
          {isPolaroid ? (
            <>
              <p className="text-[11px] font-serif italic font-bold tracking-wide truncate text-fuchsia-950">
                ~ {m.name} ♡
              </p>
              <p className="text-[7px] font-mono font-bold text-slate-600">
                {m.groupName} • #001/001 • R$ {meta.sellPrice.toFixed(0)}
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-extrabold truncate">{m.name}</p>
              <p className="text-[7px] font-mono text-amber-300">
                {m.groupName} • R$ {meta.sellPrice.toFixed(0)}
              </p>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Omnitrix K-pop */}
      <div className="omnitrix-panel relative overflow-hidden p-4 sm:p-5 rounded-2xl border-pink-500/25">
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-pink-400/70 to-transparent" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-pink-500/15 p-3 rounded-xl border border-pink-500/30 text-pink-400 shadow-[0_0_16px_rgba(236,72,153,0.2)] shrink-0">
              <Medal className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold font-display text-white text-base">🎴 K-pop Photocards & Lucky Draw</h3>
                <span className="text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
                  Commons + Ko/En Wiki API
                </span>
              </div>
              <p className="text-slate-400 text-[11px] mt-0.5 truncate">
                {GROUPS.length} grupos ({totalMembers} idols) • 5 raridades até Polaroid Assinada 1/1 (0,5%)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono shrink-0">
            <span className="bg-pink-500/10 border border-pink-500/30 text-pink-300 font-bold px-2.5 py-1 rounded-lg">
              {uniqueIdolCount}/{totalMembers} Idols
            </span>
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold px-2.5 py-1 rounded-lg">
              🎥 {grailStats.broadcasts}
            </span>
            <span className="bg-fuchsia-500/15 border border-fuchsia-400/40 text-fuchsia-200 font-bold px-2.5 py-1 rounded-lg">
              ★ {grailStats.polaroids} 1/1
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('gacha')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
            tab === 'gacha'
              ? 'bg-pink-500/20 border-pink-500 text-pink-300 shadow-[0_0_14px_rgba(236,72,153,0.25)]'
              : 'bg-[#080a12] border-[#1a1c2a] text-slate-400 hover:border-pink-500/35'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Gacha & Lucky Draw
        </button>
        <button
          onClick={() => setTab('binder')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
            tab === 'binder'
              ? 'bg-pink-500/20 border-pink-500 text-pink-300 shadow-[0_0_14px_rgba(236,72,153,0.25)]'
              : 'bg-[#080a12] border-[#1a1c2a] text-slate-400 hover:border-pink-500/35'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Binder de Coleção ({collection.length})
        </button>
      </div>

      {tab === 'gacha' && (
        <div className="space-y-4">
          {/* Seletor de Pacotes / Máquina Lucky Draw */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PACK_MODES.map((m) => {
              const active = selectedMode.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMode(m)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                    active
                      ? `bg-[#120b18] ${m.accentBorder} shadow-[0_0_20px_rgba(236,72,153,0.22)]`
                      : 'bg-[#080a12] border-[#1a1c2a] hover:border-pink-500/35'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-2xl">{m.icon}</span>
                    <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30">
                      {m.badgeText}
                    </span>
                  </div>
                  <div className="text-xs font-extrabold text-white">{m.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{m.subtitle}</div>
                  <div className="text-xs font-mono font-black text-brand mt-2">
                    R$ {m.price.toFixed(2)}
                    {m.multiPrice && (
                      <span className="text-[9px] text-fuchsia-300 font-semibold ml-1.5">
                        (5× R$ {m.multiPrice.toFixed(2)})
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bias Group Rate-Up + Probabilidades + Pity */}
          <div className="bg-[#080a12] border border-[#1a1c2a] rounded-2xl p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/5">
              <div>
                <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-pink-400" /> Grupo Bias em Rate-Up (50% de chance)
                </div>
                <p className="text-[10px] text-slate-400">
                  Foque seu grupo favorito para aumentar a chance de vir integrantes dele em qualquer pacote.
                </p>
              </div>
              <select
                value={biasGroup}
                onChange={(e) => setBiasGroup(e.target.value)}
                className="bg-[#06070d] border border-pink-500/35 rounded-xl text-xs font-bold text-slate-100 px-3 py-2 focus:outline-none focus:border-pink-400 cursor-pointer"
              >
                <option value="ALL">🌐 Todos os {GROUPS.length} Grupos</option>
                {GROUPS.map((g) => (
                  <option key={g.name} value={g.name}>
                    💜 {g.name} ({g.members.length} idols)
                  </option>
                ))}
              </select>
            </div>

            {/* Tabela de Probabilidades */}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2 flex items-center justify-between">
                <span>Probabilidades — {selectedMode.name}</span>
                {selectedMode.id === 'comeback' && (
                  <span className="text-[9px] text-pink-300 font-mono">Slot 5: 76% LD / 21% Broadcast / 3% Polaroid</span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {RARITIES.map((r) => (
                  <div key={r.lvl} className="bg-[#06070d] border border-[#1a1c2a] rounded-lg p-1.5 text-center">
                    <div className={`text-[8px] sm:text-[9px] font-bold truncate ${r.textCls}`}>{r.label}</div>
                    <div className="text-xs font-mono font-black text-white mt-0.5">
                      {(selectedMode.weights[r.lvl] * 100).toFixed(r.lvl === 4 || selectedMode.weights[r.lvl] === 0.275 || selectedMode.weights[r.lvl] === 0.265 ? 1 : 0)}%
                    </div>
                    <div className="text-[7px] font-mono text-slate-500">R$ {r.sellPrice.toFixed(0)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hard Pity Bar da Máquina Lucky Draw */}
            {selectedMode.id === 'luckydraw' && (
              <div className="bg-[#0c0714] border border-fuchsia-500/30 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-fuchsia-300 font-bold">
                    ★ Garantia de Fansign (Polaroid 1/1): {polaroidPity}/{LUCKY_DRAW_PITY_LIMIT} Cápsulas
                  </span>
                  <span className="text-slate-400">
                    Faltam {LUCKY_DRAW_PITY_LIMIT - polaroidPity} ({totalCapsules} totais)
                  </span>
                </div>
                <div className="h-2 bg-[#06070d] rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-white transition-all duration-300"
                    style={{ width: `${Math.min(100, (polaroidPity / LUCKY_DRAW_PITY_LIMIT) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botões de Abertura */}
          {selectedMode.id === 'luckydraw' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleOpen(selectedMode, 1)}
                disabled={balance < selectedMode.price || loadingPhotos}
                className="bg-gradient-to-r from-pink-500 to-fuchsia-600 hover:from-pink-400 hover:to-fuchsia-500 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-white font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all"
              >
                <Package className="w-4 h-4" /> 1× Cápsula Lucky Draw — R$ {selectedMode.price.toFixed(2)}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleOpen(selectedMode, 5)}
                disabled={balance < (selectedMode.multiPrice || 169.90) || loadingPhotos}
                className="bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 hover:brightness-110 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-slate-950 font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(244,114,182,0.38)] transition-all"
              >
                <Sparkles className="w-4 h-4" /> 5× Cápsulas (Pity +5) — R$ {(selectedMode.multiPrice || 169.90).toFixed(2)}
              </motion.button>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => handleOpen(selectedMode, 1)}
              disabled={balance < selectedMode.price || loadingPhotos}
              className="w-full bg-gradient-to-r from-pink-500 to-fuchsia-600 hover:from-pink-400 hover:to-fuchsia-500 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-white font-black py-3.5 px-5 rounded-xl text-xs uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_22px_rgba(236,72,153,0.32)] transition-all"
            >
              <Package className="w-4 h-4" /> Comprar {selectedMode.name} ({selectedMode.count} cartas) — R$ {selectedMode.price.toFixed(2)}
            </motion.button>
          )}

          {/* Vitrine de Graals */}
          <div className="bg-[#080a12] border border-[#1a1c2a] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  ✨ Vitrine de Cartas Raras (Edições Broadcast & Polaroid 1/1)
                </h4>
                <p className="text-[10px] text-slate-400">
                  Cada raridade busca fotos distintas em alta definição da Wikimedia Commons & Wikipedia KO/EN.
                </p>
              </div>
              <span className="text-[9px] font-mono text-fuchsia-300 bg-fuchsia-500/10 border border-fuchsia-500/30 px-2 py-0.5 rounded-full">
                Valor até R$ 750,00
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {renderShowcasePreviewCard('BLACKPINK-Jennie', 4)}
              {renderShowcasePreviewCard('aespa-Karina', 3)}
              {renderShowcasePreviewCard('IVE-Wonyoung', 4)}
              {renderShowcasePreviewCard('BTS-Jungkook', 3)}
            </div>
          </div>
        </div>
      )}

      {tab === 'binder' && (
        <div className="space-y-4">
          <div className="bg-[#080a12] border border-[#1a1c2a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400">
                <span className="text-pink-400 font-bold font-mono">{uniqueIdolCount}</span>/{totalMembers} idols únicos • {GROUPS.length} grupos
              </p>
              <p className="text-xs font-bold font-mono text-pink-400">{progress}%</p>
            </div>
            <div className="h-2.5 bg-[#06070d] rounded-full overflow-hidden border border-[#1a1c2a]">
              <div
                className="h-full bg-gradient-to-r from-pink-600 via-fuchsia-500 to-pink-400 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(236,72,153,0.35)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <div className="relative">
                <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar idol ou grupo..."
                  className="bg-[#07080f] border border-[#1a1c2a] rounded-lg text-[10px] text-slate-300 pl-7 pr-2.5 py-1.5 w-36 focus:outline-none focus:border-pink-500/50"
                />
              </div>
              <div className="flex items-center gap-1">
                <Filter className="w-3 h-3 text-pink-400" />
                <select
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                  className="bg-[#07080f] border border-[#1a1c2a] rounded-lg text-[10px] text-slate-300 px-2 py-1.5 focus:outline-none focus:border-pink-500/50"
                >
                  <option value="todos">Todos grupos</option>
                  {GROUPS.map((g) => (
                    <option key={g.name} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>
              <select
                value={filterRarity}
                onChange={(e) => setFilterRarity(e.target.value)}
                className="bg-[#07080f] border border-[#1a1c2a] rounded-lg text-[10px] text-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-pink-500/50"
              >
                <option value="todas">Todas raridades</option>
                {RARITIES.map((r) => (
                  <option key={r.lvl} value={String(r.lvl)}>{r.label}</option>
                ))}
              </select>
            </div>

            {collection.some((c) => c.quantity > 1) && (
              <button
                onClick={handleSellAll}
                className="bg-brand/15 hover:bg-brand text-brand hover:text-slate-950 font-bold px-3 py-1.5 rounded-xl text-[10px] border border-brand/30 transition-all cursor-pointer"
              >
                Vender Repetidas (R$ {grailStats.totalDuplicateValue.toFixed(2)})
              </button>
            )}
          </div>

          {collection.length === 0 ? (
            <div className="omnitrix-card rounded-2xl p-10 text-center">
              <BookOpen className="w-10 h-10 text-pink-400/60 mx-auto mb-3" />
              <p className="text-slate-200 text-sm font-bold">Seu binder está vazio</p>
              <p className="text-slate-400 text-xs mt-1">
                Abra Álbuns, Weverse Boxes ou gire a Máquina Lucky Draw para colecionar {totalMembers} idols!
              </p>
            </div>
          ) : groupedCollection.length === 0 ? (
            <div className="bg-[#090b13] border border-[#1a1c2a] rounded-xl p-8 text-center text-xs text-slate-500">
              Nenhuma carta encontrada com os filtros atuais.
            </div>
          ) : (
            <div className="space-y-4">
              {groupedCollection.map(([groupName, cards]) => {
                const group = GROUP_BY_NAME.get(groupName);
                const uniqueInGroup = new Set(cards.map((c) => getBaseMemberId(c.id))).size;
                const groupTotal = group ? group.members.length : uniqueInGroup;
                return (
                  <div key={groupName} className="bg-[#090b13] border border-[#1a1c2a] rounded-xl overflow-hidden">
                    <div className="px-3.5 py-2.5 flex items-center justify-between bg-[#06070d] border-b border-[#1a1c2a]">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${group?.accent || 'bg-pink-600'}`} />
                        <span className="text-xs font-extrabold text-slate-100">{groupName}</span>
                        {group && (
                          <span className="text-[9px] font-mono text-slate-500 hidden sm:inline">• {group.era}</span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-pink-400">
                        {uniqueInGroup}/{groupTotal} idols ({cards.length} edições)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 p-2.5">
                      {cards.map((card) => {
                        const rInfo = getRarityInfo(card.rarity);
                        const isPolaroid = rInfo.lvl === 4;
                        const isBroadcast = rInfo.lvl === 3;
                        const isHolo = rInfo.lvl >= 2;
                        const price = rInfo.sellPrice;

                        return (
                          <div
                            key={card.id}
                            className={`rounded-xl overflow-hidden transition-all duration-200 group relative hover:scale-[1.03] hover:z-10 ${
                              isPolaroid
                                ? 'bg-gradient-to-b from-white via-pink-50 to-fuchsia-100 p-1.5 border-2 border-white shadow-[0_0_20px_rgba(244,114,182,0.55)] shimmer-rainbow'
                                : `bg-[#06070d] border ${rInfo.borderCls} ${isHolo ? 'holo-foil' : ''}`
                            }`}
                          >
                            <div className={`aspect-[2/3] relative overflow-hidden bg-[#070910] ${isPolaroid ? 'rounded-md' : ''}`}>
                              <KpopCardImage
                                card={card}
                                commonsMap={commonsMap}
                                koThumbs={koThumbs}
                                enThumbs={enThumbs}
                                groupThumbs={groupThumbs}
                                className="w-full h-full object-cover object-top"
                              />
                              <span
                                className={`absolute top-1 left-1 text-[6px] font-black px-1 py-0.5 rounded ${
                                  isPolaroid
                                    ? 'bg-fuchsia-600 text-white'
                                    : isBroadcast
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-black/75 text-slate-200 border border-white/10'
                                }`}
                              >
                                {isPolaroid ? '★ 1/1' : isBroadcast ? '🎥 /100' : rInfo.code}
                              </span>
                              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                            </div>
                            <div className={`p-1.5 text-center ${isPolaroid ? 'bg-transparent text-slate-900' : 'bg-[#070910]'}`}>
                              {isPolaroid ? (
                                <>
                                  <p className="text-[10px] font-serif italic font-bold text-fuchsia-950 truncate">~ {card.name} ♡</p>
                                  <p className="text-[7px] font-mono font-bold text-slate-600">
                                    #001/001 {card.quantity > 1 && <span className="text-fuchsia-700">×{card.quantity}</span>}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-[9px] font-bold text-slate-100 truncate">{card.name}</p>
                                  <p className={`text-[7px] font-bold truncate ${rInfo.textCls}`}>
                                    {rInfo.label}
                                    {card.quantity > 1 && <span className="text-brand ml-1">×{card.quantity}</span>}
                                  </p>
                                </>
                              )}
                            </div>
                            {card.quantity > 1 && (
                              <button
                                onClick={() => {
                                  onSellCard(card.id, price);
                                  play('cashout');
                                }}
                                className="absolute top-1 right-1 z-20 bg-brand hover:bg-[#00e074] text-slate-950 text-[7px] font-black px-1.5 py-0.5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100 shadow"
                              >
                                R$ {price.toFixed(2)}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Abertura / Revelação */}
      <AnimatePresence>
        {opening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/94 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="text-center max-w-4xl w-full my-auto">
              <motion.h3 initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-pink-400 font-extrabold font-display text-lg mb-2">
                {lastRollRef.current.mode.icon} {lastRollRef.current.mode.name}
              </motion.h3>

              {loadingPhotos || packResult.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <div
                    className="w-24 h-24 rounded-full border-2 border-pink-400/75 bg-[#190a18] flex items-center justify-center gacha-pack-charge relative"
                    style={{ '--charge-color': 'rgba(236,72,153,0.6)' } as CSSProperties}
                  >
                    <div className="absolute inset-1 rounded-full border border-dashed border-fuchsia-300/60 animate-omnitrix-spin" />
                    <span className="text-4xl relative z-10">{lastRollRef.current.mode.icon}</span>
                  </div>
                  <p className="text-xs font-mono text-pink-300 mt-4 animate-pulse">
                    Sorteando photocards & carregando retratos HD...
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-3 mb-5 flex-wrap">
                    <p className="text-slate-400 text-xs font-mono">
                      {Math.max(0, revealingIndex + 1)} de {packResult.length} photocards
                    </p>
                    {revealingIndex < packResult.length - 1 ? (
                      <button
                        onClick={() => {
                          if (skipHandledRef.current) return;
                          skipHandledRef.current = true;
                          skipRef.current = true;
                          setRevealingIndex(packResult.length - 1);
                          const maxLvl = Math.max(...packResult.map((c) => getRarityLevel(c.rarity)));
                          play(maxLvl >= 3 ? 'legendary' : maxLvl === 2 ? 'rare' : 'reveal');
                          onCollectionUpdate(packResult);
                        }}
                        className="text-xs text-pink-300 font-bold uppercase tracking-wider cursor-pointer px-3 py-1.5 rounded-lg bg-pink-500/15 border border-pink-500/35"
                      >
                        Revelar Tudo
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap justify-center">
                        {(() => {
                          const { mode, qty } = lastRollRef.current;
                          const againCost = qty === 5 && mode.multiPrice ? mode.multiPrice : mode.price;
                          if (balance < againCost) return null;
                          return (
                            <button
                              onClick={() => handleOpen(mode, qty as 1 | 5, true)}
                              className="text-xs text-white bg-gradient-to-r from-pink-500 to-fuchsia-600 hover:from-pink-400 hover:to-fuchsia-500 font-black uppercase tracking-wider cursor-pointer px-4 py-1.5 rounded-lg shadow-[0_0_16px_rgba(236,72,153,0.35)]"
                            >
                              🔄 Abrir Mais {qty === 5 ? '5× ' : 'Um '}(R$ {againCost.toFixed(2)})
                            </button>
                          );
                        })()}
                        <button
                          onClick={() => {
                            setOpening(false);
                            setPackResult([]);
                          }}
                          className="text-xs text-slate-950 bg-brand hover:bg-[#00e074] font-black uppercase tracking-wider cursor-pointer px-4 py-1.5 rounded-lg"
                        >
                          Concluir
                        </button>
                      </div>
                    )}
                  </div>

                  <div
                    className={`grid gap-3 justify-items-center ${
                      packResult.length === 1
                        ? 'grid-cols-1 max-w-[200px] mx-auto'
                        : packResult.length === 4
                        ? 'grid-cols-2 sm:grid-cols-4 max-w-2xl mx-auto'
                        : 'grid-cols-2 sm:grid-cols-5'
                    }`}
                  >
                    {packResult.map((card, idx) => {
                      const rInfo = getRarityInfo(card.rarity);
                      const isPolaroid = rInfo.lvl === 4;
                      const isBroadcast = rInfo.lvl === 3;
                      const isHolo = rInfo.lvl >= 2;
                      const isRevealed = idx <= revealingIndex;
                      const isNew = !ownedSnapshot.has(card.id);

                      if (!isRevealed) {
                        return (
                          <motion.div
                            key={`back-${idx}`}
                            initial={{ scale: 0.75, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`w-full max-w-[165px] aspect-[2/3] rounded-xl border-2 gacha-card-back flex flex-col items-center justify-center p-2 ${
                              isPolaroid
                                ? 'border-white shadow-[0_0_24px_rgba(244,114,182,0.7)]'
                                : isBroadcast
                                ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)]'
                                : isHolo
                                ? 'border-pink-400/80 shadow-[0_0_14px_rgba(236,72,153,0.35)]'
                                : 'border-pink-500/25'
                            }`}
                          >
                            <Medal className={`w-6 h-6 animate-pulse ${isBroadcast || isPolaroid ? 'text-amber-300' : isHolo ? 'text-pink-300' : 'text-brand'}`} />
                            <span className="text-[8px] font-mono text-slate-300 mt-2 uppercase tracking-widest">
                              {isPolaroid ? '★ 1/1 POLAROID' : isBroadcast ? 'BROADCAST' : isHolo ? 'LUCKY DRAW' : 'PHOTOCARD'}
                            </span>
                          </motion.div>
                        );
                      }

                      return (
                        <motion.div
                          key={idx}
                          initial={{ rotateY: 90, opacity: 0, scale: 0.8 }}
                          animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                          className={`w-full max-w-[165px] rounded-xl overflow-hidden shadow-lg relative ${
                            isPolaroid
                              ? 'bg-gradient-to-b from-white via-pink-50 to-fuchsia-100 p-2 border-2 border-white shadow-[0_0_28px_rgba(244,114,182,0.8)] shimmer-rainbow gacha-float'
                              : `bg-[#0c0e18] border-2 ${rInfo.borderCls} ${isHolo ? 'holo-foil gacha-float' : ''}`
                          }`}
                        >
                          {isHolo && (
                            <div
                              className="gacha-light-beam opacity-55"
                              style={{ '--beam-color': rInfo.glow } as CSSProperties}
                            />
                          )}
                          {isNew && (
                            <span className="absolute top-1.5 right-1.5 z-30 bg-brand text-slate-950 text-[7px] font-black px-1.5 py-0.5 rounded-full shadow">
                              NEW
                            </span>
                          )}
                          {!isNew && isHolo && (
                            <div className="absolute top-1.5 right-1.5 z-20">
                              <Star className={`w-3.5 h-3.5 ${isPolaroid ? 'text-fuchsia-500' : isBroadcast ? 'text-amber-300' : 'text-pink-400'}`} fill="currentColor" />
                            </div>
                          )}

                          <div className={`aspect-[2/3] relative overflow-hidden bg-[#06070d] z-10 ${isPolaroid ? 'rounded-lg shadow-inner' : ''}`}>
                            <KpopCardImage
                              card={card}
                              commonsMap={commonsMap}
                              koThumbs={koThumbs}
                              enThumbs={enThumbs}
                              groupThumbs={groupThumbs}
                              className="w-full h-full object-cover object-top"
                            />
                            <span
                              className={`absolute top-1.5 left-1.5 text-[7px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                isPolaroid
                                  ? 'bg-fuchsia-600/95 text-white border-white/40'
                                  : isBroadcast
                                  ? 'bg-amber-400 text-slate-950 border-amber-200'
                                  : 'bg-black/80 text-pink-300 border-white/15'
                              }`}
                            >
                              {isPolaroid ? rInfo.shortTag : card.setName}
                            </span>
                            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />
                          </div>

                          <div className={`pt-2 pb-1 px-1.5 text-center relative z-10 ${isPolaroid ? 'bg-transparent text-slate-900' : 'bg-[#080a12]'}`}>
                            {isPolaroid ? (
                              <>
                                <p className="text-[12px] font-serif italic font-bold text-fuchsia-950 truncate">
                                  ~ {card.name} ♡
                                </p>
                                <p className="text-[8px] font-mono font-bold text-slate-600 truncate">
                                  {card.setName} • #001/001 • R$ {rInfo.sellPrice.toFixed(0)}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-[11px] font-extrabold text-slate-100 truncate">{card.name}</p>
                                <p className={`text-[8px] font-bold truncate ${rInfo.textCls}`}>
                                  {rInfo.shortTag} • R$ {rInfo.sellPrice.toFixed(2)}
                                </p>
                              </>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
