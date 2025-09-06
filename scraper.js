// scraper.js - 코웨이 프로모션 자동 스크래핑 (무한로딩 방지 강화 버전)
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 스크래핑할 사이트들 (확장된 리스트)
const SCRAPE_TARGETS = [
  {
    name: '코웨이 공식 뉴스룸',
    url: 'https://company.coway.com/newsroom/press',
    selector: '.press-list .item, .news-item, .press-item',
    type: 'news'
  },
  {
    name: '코웨이 이벤트 페이지',
    url: 'https://www.coway.com/event/list',
    selector: '.event-item, .promotion-item, .event-card',
    type: 'event'
  },
  {
    name: '코웨이 제휴카드 혜택',
    url: 'https://coway-m.com/card',
    selector: '.card-benefit, .discount-info, .promotion-box',
    type: 'card'
  },
  {
    name: '코웨이 인증점 1',
    url: 'https://cowayga.com/',
    selector: '.promotion-banner, .event-banner, .discount-info',
    type: 'dealer'
  },
  {
    name: '코웨이 인증점 2',
    url: 'https://cowaydirect.co.kr/',
    selector: '.promo-item, .event-item, .discount-banner',
    type: 'dealer'
  },
  {
    name: '코웨이 특별할인몰',
    url: 'https://coway-korea.com/',
    selector: '.special-offer, .discount-item, .promotion-card',
    type: 'discount'
  },
  {
    name: '코웨이 렌탈샵',
    url: 'https://coway-m.com/',
    selector: '.rental-promo, .discount-info, .special-event',
    type: 'rental'
  }
];

// 고객이 좋아하는 프로모션 키워드
const HIGH_VALUE_KEYWORDS = [
  { keywords: ['반값', '50%', '반가격'], priority: 10, emoji: '🔥' },
  { keywords: ['60%', '70%', '80%'], priority: 9, emoji: '💥' },
  { keywords: ['40%', '45%'], priority: 8, emoji: '⚡' },
  { keywords: ['30%', '35%'], priority: 7, emoji: '🎯' },
  { keywords: ['20%', '25%'], priority: 6, emoji: '💰' },
  { keywords: ['무료', '공짜', '0원'], priority: 9, emoji: '🆓' },
  { keywords: ['증정', '선물', '사은품'], priority: 7, emoji: '🎁' },
  { keywords: ['18개월', '12개월', '24개월'], priority: 8, emoji: '📅' },
  { keywords: ['6개월', '3개월'], priority: 6, emoji: '⏰' },
  { keywords: ['페스타', '빅세일', '대박세일'], priority: 8, emoji: '🎉' },
  { keywords: ['런칭', '신상품', '출시'], priority: 7, emoji: '✨' },
  { keywords: ['한정', '특가', '긴급'], priority: 7, emoji: '⚠️' },
  { keywords: ['설치비무료', '등록비무료'], priority: 6, emoji: '🔧' },
  { keywords: ['캐시백', '적립'], priority: 6, emoji: '💳' },
  { keywords: ['경품', '추첨', '럭키드로우'], priority: 5, emoji: '🎲' }
];

// 제품별 아이콘 매핑
const PRODUCT_ICONS = {
  '정수기': '💧', '아이콘': '⭐', '노블': '👑', '프라임': '🌟',
  '공기청정기': '💨', '에어': '🌪️',
  '비데': '🚿', '룰루': '🌸', '더블케어': '💎',
  '매트리스': '🛏️', '슬립케어': '😴', '비렉스': '⚡',
  '안마의자': '🪑', '트리플체어': '👨‍⚕️',
  '제습기': '💨', '연수기': '💧', '얼음정수기': '🧊',
  '인덕션': '🔥', '의류청정기': '👕'
};

async function scrapePromotions() {
  console.log('🕷️ 코웨이 프로모션 스크래핑 시작...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });
  
  const allPromotions = [];
  
  for (const target of SCRAPE_TARGETS) {
    try {
      console.log(`📡 ${target.name} 스크래핑 중...`);
      const page = await browser.newPage();

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      page.setDefaultNavigationTimeout(60000);
      page.setDefaultTimeout(60000);

      // 리소스 차단
      await page.setRequestInterception(true);
      page.on('request', req => {
        const r = req.resourceType();
        if (['image','stylesheet','font','media'].includes(r)) req.abort();
        else req.continue();
      });

      try {
        await page.goto(target.url, { waitUntil: 'networkidle2', timeout: 60000 });
      } catch(e) {
        console.warn(`⚠️ page.goto 경고: ${target.url} - ${e.message}`);
      }

      try {
        await page.waitForSelector(target.selector, { timeout: 8000 });
      } catch(e) {
        console.info(`ℹ️ selector 미발견: ${target.selector}`);
      }

      // 안정적 스크롤
      await page.evaluate(async () => {
        const distance = 400;
        const maxScrolls = 30;
        const pauseMs = 700;
        let scrolls = 0;
        function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
        while(scrolls++ < maxScrolls){
          const prevHeight = document.body.scrollHeight;
          window.scrollBy(0,distance);
          await sleep(pauseMs);
          const newHeight = document.body.scrollHeight;
          if(newHeight === prevHeight){
            await sleep(1200);
            if(document.body.scrollHeight === prevHeight) break;
          }
        }
      });
      await page.waitForTimeout(700);

      await page.setRequestInterception(false);
      page.removeAllListeners('request');

      const promotions = await page.evaluate((selector, targetName, highValueKeywords, productIcons) => {
        const items = Array.from(document.querySelectorAll(selector));
        const textElements = Array.from(document.querySelectorAll('div,p,span,h1,h2,h3,h4,h5,h6'));
        const allElements = [...items, ...textElements];
        const results = [];
        const processedTexts = new Set();

        allElements.forEach((item,index)=>{
          if(index<200){
            const text=item.innerText||item.textContent||'';
            if(processedTexts.has(text)||text.length<15) return;
            processedTexts.add(text);

            let matchedKeywords=[];
            let totalPriority=0;
            let bestEmoji='🎯';
            highValueKeywords.forEach(group=>{
              const matched=group.keywords.filter(k=>text.includes(k));
              if(matched.length>0){
                matchedKeywords.push(...matched);
                totalPriority+=group.priority*matched.length;
                bestEmoji=group.emoji;
              }
            });

            if(totalPriority>=5){
              const productKeywords=['정수기','공기청정기','비데','매트리스','안마의자','제습기','연수기','아이콘','노블','룰루','비렉스','프라임','얼음정수기','인덕션','의류청정기'];
              let product='코웨이 제품';
              let productIcon='🏠';
              for(const keyword of productKeywords){
                if(text.includes(keyword)){
                  product=keyword.includes('아이콘')?'아이콘 정수기':
                          keyword.includes('노블')?'노블 시리즈':
                          keyword.includes('룰루')?'룰루 비데':
                          keyword.includes('비렉스')?'비렉스 매트리스':keyword;
                  productIcon=productIcons[keyword]||'🏠';
                  break;
                }
              }

              let promotion='';
              const lines=text.split('\n').filter(l=>l.trim().length>5);
              if(lines.length>0){
                promotion=lines[0].trim();
                if(promotion.length>40) promotion=promotion.substring(0,40)+'...';
              }
              if(!promotion) promotion=text.substring(0,30).trim()+'...';

              let benefit='';
              const benefits=[];
              const discountMatches=text.match(/\d+%[^.]*?할인/g);
              if(discountMatches) benefits.push(...discountMatches);
              const freeMatches=text.match(/[^.]*?무료[^.]*/g);
              if(freeMatches) benefits.push(...freeMatches.slice(0,2));
              const periodMatches=text.match(/\d+개월[^.]*?/g);
              if(periodMatches) benefits.push(...periodMatches.slice(0,2));
              const giftMatches=text.match(/[^.]*?증정[^.]*/g);
              if(giftMatches) benefits.push(...giftMatches.slice(0,1));
              benefit=benefits.slice(0,3).join(' + ')||'특별 혜택 제공';

              let remark=targetName;
              const remarkParts=[];
              const dateMatches=text.match(/\d+월\s*\d+일?까지|\d+\/\d+까지|~\s*\d+월/g);
              if(dateMatches) remarkParts.push(dateMatches[0]);
              const conditionMatches=text.match(/(온라인|매장|신규|재렌탈|한정)[^.]*?/g);
              if(conditionMatches) remarkParts.push(...conditionMatches.slice(0,1));
              if(remarkParts.length>0) remark=remarkParts.join(' • ');

              results.push({
                product:productIcon+' '+product,
                promotion:bestEmoji+' '+promotion,
                benefit:benefit,
                remark:remark,
                source:targetName,
                priority:totalPriority,
                keywords:matchedKeywords,
                scraped:new Date().toISOString()
              });
            }
          }
        });
        return results.sort((a,b)=>b.priority-a.priority);
      }, target.selector, target.name, HIGH_VALUE_KEYWORDS, PRODUCT_ICONS);

      allPromotions.push(...promotions);
      console.log(`✅ ${target.name}에서 ${promotions.length}개 프로모션 발견`);
      await page.close();
      await new Promise(r=>setTimeout(r,2000));
    } catch(err){
      console.error(`❌ ${target.name} 실패:`,err.message);
    }
  }

  await browser.close();
  const uniquePromotions=removeDuplicatesAndFilter(allPromotions);
  if(uniquePromotions.length<3) uniquePromotions.push(...getHighValueBackupData());
  const finalPromotions=uniquePromotions.sort((a,b)=>b.priority-a.priority).slice(0,20);
  console.log(`🎉 총 ${finalPromotions.length}개 프로모션 수집 완료`);
  return finalPromotions;
}

function removeDuplicatesAndFilter(promotions){
  const seen=new Set();
  const filtered=[];
  promotions.forEach(p=>{
    const key=`${p.product}-${p.benefit}`;
    if(!seen.has(key)&&p.benefit.length>10&&p.priority>=5&&!p.benefit.includes('undefined')){
      seen.add(key);
      filtered.push(p);
    }
  });
  return filtered;
}

function getHighValueBackupData(){
  return [
    {
      product:"⭐ 아이콘 정수기 시리즈",
      promotion:"🔥 2025 코웨이페스타",
      benefit:"최대 12개월 렌탈료 50% 할인 + 설치비 무료 + 케어서비스 1년",
      remark:"연중 최대 프로모션 • ~4월 28일",
      source:"코웨이 공식",
      priority:10,
      keywords:["50%","12개월","무료"],
      scraped:new Date().toISOString()
    }
  ];
}

async function updatePromoData(){
  try{
    console.log('🚀 코웨이 프로모션 업데이트 시작...');
    const promotions=await scrapePromotions();
    fs.writeFileSync('promotions.json',JSON.stringify(promotions,null,2));
    console.log('✅ promotions.json 저장 완료');
    updateHTMLFile(promotions);
    console.log(`📊 총 ${promotions.length}개 프로모션 저장됨`);
  }catch(e){
    console.error('❌ 업데이트 실패:',e);
    const backup=getHighValueBackupData();
    fs.writeFileSync('promotions.json',JSON.stringify(backup,null,2));
  }
}

function updateHTMLFile(promotions){
  try{
    const htmlPath='index.html';
    if(!fs.existsSync(htmlPath)) return;
    let htmlContent=fs.readFileSync(htmlPath,'utf8');
    const updateTime=new Date().toLocaleString('ko-KR');
    const dataScript=`
    <script>
    window.LIVE_PROMOTION_DATA=${JSON.stringify(promotions,null,2)};
    window.LAST_SCRAPED="${updateTime}";
    window.SCRAPING_STATUS="LIVE";
    </script>`;
    if(htmlContent.includes('window.LIVE_PROMOTION_DATA')){
      htmlContent=htmlContent.replace(/<script>[\s\S]*?window\.LIVE_PROMOTION_DATA[\s\S]*?<\/script>/,dataScript);
    }else{
      htmlContent=htmlContent.replace('</head>',dataScript+'\n</head>');
    }
    fs.writeFileSync(htmlPath,htmlContent);
    console.log('✅ HTML 업데이트 완료');
  }catch(e){console.error('❌ HTML 업데이트 실패:',e);}
}

if(require.main===module){updatePromoData();}
module.exports={scrapePromotions,updatePromoData};
