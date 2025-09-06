// scraper.js - 코웨이 프로모션 자동 스크래핑 (수정본)
const puppeteer = require('puppeteer');
const fs = require('fs');

// 스크래핑할 사이트들
const SCRAPE_TARGETS = [
  {
    name: '코웨이 뉴스룸',
    url: 'https://company.coway.com/newsroom/press',
    selector: '.press-list .item',
    type: 'news'
  },
  {
    name: '코웨이 이벤트',
    url: 'https://www.coway.com/event/list',
    selector: '.event-item',
    type: 'event'
  },
  {
    name: '인증점 프로모션',
    url: 'https://cowayga.com/',
    selector: '.promotion-banner, .event-banner',
    type: 'dealer'
  }
];

async function scrapePromotions() {
  console.log('코웨이 프로모션 스크래핑 시작...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const allPromotions = [];
  
  for (const target of SCRAPE_TARGETS) {
    try {
      console.log(`${target.name} 스크래핑 중...`);
      
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );
      
      await page.goto(target.url, { 
        waitUntil: 'domcontentloaded', // networkidle2 → domcontentloaded
        timeout: 15000 // 30초 → 15초
      });
      console.log(`${target.name} page.goto 완료`);
      
      await page.waitForTimeout(2000); // 짧게 대기
      console.log(`${target.name} page.evaluate 시작`);
      
      const promotions = await page.evaluate((selector, targetName) => {
        const items = document.querySelectorAll(selector);
        const results = [];
        
        items.forEach((item, index) => {
          if (index >= 5) return; // 5개까지만
        
          const text = item.innerText || item.textContent || '';
          const promoKeywords = ['할인', '프로모션', '이벤트', '특가', '무료', '증정', '혜택', '반값'];
          const hasPromoKeyword = promoKeywords.some(keyword => text.includes(keyword));
          
          if (hasPromoKeyword && text.length > 10) {
            const productKeywords = ['정수기', '공기청정기', '비데', '매트리스', '안마의자', '제습기', '연수기', '아이콘', '노블'];
            let product = '코웨이 제품';
            
            for (const keyword of productKeywords) {
              if (text.includes(keyword)) {
                if (keyword === '아이콘') product = '아이콘 정수기';
                else if (keyword === '노블') product = '노블 시리즈';
                else product = keyword;
                break;
              }
            }
            
            let promotion = text.split('\n')[0] || '특별 프로모션';
            if (promotion.length > 30) {
              promotion = promotion.substring(0, 30) + '...';
            }
            
            let benefit = '';
            if (text.includes('%')) {
              const percentMatch = text.match(/\d+%[^.]*할인/g);
              if (percentMatch) benefit = percentMatch[0];
            }
            if (text.includes('무료')) {
              const freeMatch = text.match(/[^.]*무료[^.]*/g);
              if (freeMatch) benefit += (benefit ? ' + ' : '') + freeMatch[0];
            }
            if (!benefit) benefit = '특별 혜택 제공';
            
            let remark = targetName + ' 확인';
            if (text.includes('까지')) {
              const dateMatch = text.match(/\d+월\s*\d+일까지/g);
              if (dateMatch) remark = dateMatch[0];
            }
            
            results.push({
              product,
              promotion,
              benefit,
              remark,
              source: targetName,
              scraped: new Date().toISOString()
            });
          }
        });
        
        return results;
      }, target.selector, target.name);
      
      console.log(`${target.name} page.evaluate 완료, ${promotions.length}개 발견`);
      
      allPromotions.push(...promotions);
      await page.close();
      
    } catch (error) {
      console.error(`${target.name} 스크래핑 실패:`, error.message);
    }
  }
  
  await browser.close();
  
  const uniquePromotions = removeDuplicates(allPromotions);
  
  if (uniquePromotions.length === 0) {
    console.log('스크래핑 데이터 없음. 백업 데이터 사용');
    uniquePromotions.push(...getBackupData());
  }
  
  console.log(`총 ${uniquePromotions.length}개 프로모션 수집 완료`);
  return uniquePromotions;
}

function removeDuplicates(promotions) {
  const seen = new Set();
  return promotions.filter(promo => {
    const key = `${promo.product}-${promo.promotion}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getBackupData() {
  return [
    {
      product: "아이콘 정수기 시리즈",
      promotion: "2025 코웨이페스타",
      benefit: "최대 12개월 렌탈료 50% 할인",
      remark: "연중 최대 프로모션",
      source: "백업 데이터",
      scraped: new Date().toISOString()
    },
    {
      product: "얼음정수기 전 라인업",
      promotion: "아이스 빅 페스타",
      benefit: "최대 18개월 렌탈료 반값",
      remark: "여름 특가",
      source: "백업 데이터", 
      scraped: new Date().toISOString()
    },
    {
      product: "제습기 4개 모델",
      promotion: "제습기 반값 프로모션",
      benefit: "최대 12개월 렌탈료 50% 할인",
      remark: "패키지 할인",
      source: "백업 데이터",
      scraped: new Date().toISOString()
    }
  ];
}

async function updatePromoData() {
  try {
    const promotions = await scrapePromotions();
    fs.writeFileSync('promotions.json', JSON.stringify(promotions, null, 2));
    updateHTMLFile(promotions);
    console.log('프로모션 데이터 업데이트 완료');
  } catch (error) {
    console.error('업데이트 실패:', error);
    process.exit(1);
  }
}

function updateHTMLFile(promotions) {
  try {
    const htmlPath = 'index.html';
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    const updateTime = new Date().toLocaleString('ko-KR');
    
    const dataScript = `
    <script>
    // 자동 생성된 프로모션 데이터 (${updateTime})
    window.LIVE_PROMOTION_DATA = ${JSON.stringify(promotions, null, 2)};
    window.LAST_SCRAPED = "${updateTime}";
    </script>`;
    
    if (htmlContent.includes('window.LIVE_PROMOTION_DATA')) {
      htmlContent = htmlContent.replace(
        /<script>[\s\S]*?window\.LIVE_PROMOTION_DATA[\s\S]*?<\/script>/,
        dataScript
      );
    } else {
      htmlContent = htmlContent.replace('</head>', dataScript + '\n</head>');
    }
    
    fs.writeFileSync(htmlPath, htmlContent);
    console.log('HTML 파일 업데이트 완료');
    
  } catch (error) {
    console.error('HTML 업데이트 실패:', error);
  }
}

if (require.main === module) {
  updatePromoData();
}

module.exports = { scrapePromotions, updatePromoData };
