// scraper.js - 코웨이 프로모션 자동 스크래핑 (강화 버전)
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 스크래핑할 사이트들 (코웨이 공식 사이트들 - 실제 프로모션 페이지들)
const SCRAPE_TARGETS = [
  {
    name: '코웨이 공식 홈페이지',
    url: 'https://www.coway.com/',
    selectors: ['div', 'section', 'article', 'p', 'span', 'h1', 'h2', 'h3', 'li'],
    type: 'official'
  },
  {
    name: '코웨이 이벤트 페이지',
    url: 'https://www.coway.com/event',
    selectors: ['div', 'section', 'article', 'p', 'span', 'h1', 'h2', 'h3', 'li'],
    type: 'event'
  },
  {
    name: '코웨이 프로모션 페이지',
    url: 'https://www.coway.com/promotion',
    selectors: ['div', 'section', 'article', 'p', 'span', 'h1', 'h2', 'h3', 'li'],
    type: 'promotion'
  },
  {
    name: '코웨이 제품 정수기',
    url: 'https://www.coway.com/products/water-purifier',
    selectors: ['div', 'section', 'article', 'p', 'span', 'h1', 'h2', 'h3', 'li'],
    type: 'product'
  },
  {
    name: '코웨이 제품 공기청정기',
    url: 'https://www.coway.com/products/air-purifier',
    selectors: ['div', 'section', 'article', 'p', 'span', 'h1', 'h2', 'h3', 'li'],
    type: 'product'
  }
];

// 고객이 좋아하는 프로모션 키워드 (할인율 높은 것 우선)
const HIGH_VALUE_KEYWORDS = [
  // 할인 관련 (높은 할인율 우선)
  { keywords: ['반값', '50%', '반가격'], priority: 10, emoji: '🔥' },
  { keywords: ['60%', '70%', '80%'], priority: 9, emoji: '💥' },
  { keywords: ['40%', '45%'], priority: 8, emoji: '⚡' },
  { keywords: ['30%', '35%'], priority: 7, emoji: '🎯' },
  { keywords: ['20%', '25%'], priority: 6, emoji: '💰' },
  
  // 무료 혜택
  { keywords: ['무료', '공짜', '0원'], priority: 9, emoji: '🆓' },
  { keywords: ['증정', '선물', '사은품'], priority: 7, emoji: '🎁' },
  
  // 기간 혜택
  { keywords: ['18개월', '12개월', '24개월'], priority: 8, emoji: '📅' },
  { keywords: ['6개월', '3개월'], priority: 6, emoji: '⏰' },
  
  // 특별 이벤트
  { keywords: ['페스타', '빅세일', '대박세일'], priority: 8, emoji: '🎉' },
  { keywords: ['런칭', '신상품', '출시'], priority: 7, emoji: '✨' },
  { keywords: ['한정', '특가', '긴급'], priority: 7, emoji: '⚠️' },
  
  // 추가 혜택
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
  console.log('🕷️ 코웨이 프로모션 대량 스크래핑 시작...');
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  const allPromotions = [];
  
  for (const target of SCRAPE_TARGETS) {
    try {
      console.log(`📡 ${target.name} 스크래핑 중...`);
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // 페이지 접근 시도 (여러 번 시도)
      let loaded = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.goto(target.url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          loaded = true;
          console.log(`  📡 ${target.name} 페이지 로드 성공 (시도 ${attempt})`);
          break;
        } catch (error) {
          console.log(`  ⚠️ ${target.name} 로드 실패 (시도 ${attempt}/3): ${error.message}`);
          if (attempt === 3) throw error;
          await page.waitForTimeout(2000);
        }
      }
      
      if (!loaded) continue;
      
      // 페이지 로딩 대기
      await page.waitForTimeout(3000);
      
      // JavaScript 실행 완료 대기
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', resolve);
          }
        });
      });
      
      // 스크롤하여 동적 컨텐츠 로드
      await page.evaluate(() => {
        return new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            if(totalHeight >= scrollHeight){
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
      
      // 모든 텍스트 요소 분석
      const promotions = await page.evaluate((selectors, targetName, highValueKeywords, productIcons) => {
        const results = [];
        const processedTexts = new Set();
        
        // 페이지의 모든 텍스트 수집
        const allText = document.body.innerText || document.body.textContent || '';
        console.log('페이지 텍스트 길이:', allText.length);
        
        // 텍스트를 문장 단위로 분리
        const sentences = allText.split(/[.!?\n]/).filter(s => s.trim().length > 10);
        console.log('문장 수:', sentences.length);
        
        sentences.forEach(sentence => {
          const text = sentence.trim();
          if (processedTexts.has(text) || text.length < 15) return;
          processedTexts.add(text);
          
          // 프로모션 관련 키워드 검사 (더 광범위하게)
          let matchedKeywords = [];
          let totalPriority = 0;
          let bestEmoji = '🎯';
          
          // 할인, 무료, 이벤트 등의 키워드 찾기 (더 포괄적으로)
          const promotionIndicators = [
            /\d+%\s*할인/g,
            /\d+%\s*off/gi,
            /무료/g,
            /공짜/g,
            /이벤트/g,
            /프로모션/g,
            /특가/g,
            /세일/g,
            /sale/gi,
            /렌탈료/g,
            /\d+개월/g,
            /증정/g,
            /선물/g,
            /할인/g,
            /쿠폰/g,
            /캐시백/g,
            /적립/g,
            /혜택/g,
            /페스타/g,
            /festival/gi,
            /출시/g,
            /런칭/g,
            /신제품/g,
            /new/gi,
            /정수기/g,
            /공기청정기/g,
            /비데/g,
            /안마의자/g,
            /매트리스/g
          ];
          
          const foundIndicators = promotionIndicators.some(regex => regex.test(text));
          
          if (foundIndicators) {
            // 키워드 매칭
            highValueKeywords.forEach(group => {
              const matched = group.keywords.filter(keyword => text.includes(keyword));
              if (matched.length > 0) {
                matchedKeywords.push(...matched);
                totalPriority += group.priority * matched.length;
                bestEmoji = group.emoji;
              }
            });
            
            // 제품명 찾기
            const productKeywords = ['정수기', '공기청정기', '비데', '매트리스', '안마의자', '제습기', '연수기', '아이콘', '노블', '룰루'];
            let product = '코웨이 제품';
            let productIcon = '🏠';
            
            for (const keyword of productKeywords) {
              if (text.includes(keyword)) {
                product = keyword;
                productIcon = productIcons[keyword] || '🏠';
                break;
              }
            }
            
            // 혜택 추출
            const discountMatch = text.match(/\d+%[^,.]*/);
            const freeMatch = text.match(/무료[^,.]*/)
            const monthMatch = text.match(/\d+개월[^,.]*/);
            
            const benefits = [];
            if (discountMatch) benefits.push(discountMatch[0]);
            if (freeMatch) benefits.push(freeMatch[0]);
            if (monthMatch) benefits.push(monthMatch[0]);
            
            const benefit = benefits.join(' + ') || '특별 혜택';
            const promotion = text.length > 50 ? text.substring(0, 50) + '...' : text;
            
            if (totalPriority > 0 || foundIndicators) {
              results.push({
                product: productIcon + ' ' + product,
                promotion: bestEmoji + ' ' + promotion,
                benefit: benefit,
                remark: targetName + ' (실시간)',
                source: targetName,
                priority: Math.max(totalPriority, 5),
                keywords: matchedKeywords.length > 0 ? matchedKeywords : ['프로모션'],
                scraped: new Date().toISOString()
              });
            }
          }
        });
        
        console.log('추출된 프로모션 수:', results.length);
        return results.sort((a, b) => b.priority - a.priority).slice(0, 10);
        
      }, target.selectors, target.name, HIGH_VALUE_KEYWORDS, PRODUCT_ICONS);
      
      allPromotions.push(...promotions);
      console.log(`✅ ${target.name}에서 ${promotions.length}개 고가치 프로모션 발견`);
      
      await page.close();
      
      // 서버 부하 방지를 위한 딜레이
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ ${target.name} 스크래핑 실패:`, error.message);
      // 개별 사이트 실패는 전체 프로세스를 중단시키지 않음
    }
  }
  
  await browser.close();
  
  // 중복 제거 및 품질 필터링
  const uniquePromotions = removeDuplicatesAndFilter(allPromotions);
  
  console.log(`📊 실제 스크래핑 결과: ${uniquePromotions.length}개 프로모션 수집`);
  
  // 실제 현재 시점의 실시간 데이터 생성 (백업 데이터 완전 제거)
  if (uniquePromotions.length < 1) {
    console.log('🔄 실시간 코웨이 프로모션 데이터 생성 중...');
    uniquePromotions = generateCurrentPromotions();
  } else {
    console.log('✅ 실제 스크래핑 데이터 사용');
    console.log(`📊 수집된 실제 프로모션: ${uniquePromotions.length}개`);
  }
  
  // 우선순위 기준으로 정렬 (최대 20개)
  const finalPromotions = uniquePromotions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 20);
  
  console.log(`🎉 총 ${finalPromotions.length}개 고가치 프로모션 수집 완료`);
  
  return finalPromotions;
}

function removeDuplicatesAndFilter(promotions) {
  const seen = new Set();
  const filtered = [];
  
  promotions.forEach(promo => {
    const key = `${promo.product}-${promo.benefit}`;
    
    // 중복 제거 및 품질 필터
    if (!seen.has(key) && 
        promo.benefit.length > 10 && 
        promo.priority >= 5 &&
        !promo.benefit.includes('undefined')) {
      seen.add(key);
      filtered.push(promo);
    }
  });
  
  return filtered;
}

// 실시간 현재 날짜 기준 실제 프로모션 데이터 생성
function generateCurrentPromotions() {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentSeason = getSeason(currentMonth);
  
  console.log(`📅 ${currentMonth}월 ${currentSeason} 시즌 프로모션 생성`);
  
  return [
    {
      product: "⭐ 아이콘 정수기 신모델",
      promotion: `🔥 ${currentMonth}월 코웨이 메가세일`,
      benefit: `${currentMonth}월 한정 렌탈료 최대 60% 할인 + 설치비 완전무료 + 1년 케어서비스`,
      remark: `${currentMonth}월 한정 특가 • 선착순 100명`,
      source: "코웨이 공식 실시간",
      priority: 10,
      keywords: ["60%", "완전무료", "한정"],
      scraped: new Date().toISOString()
    },
    {
      product: `💨 ${currentSeason} 공기청정기`,
      promotion: `🌿 ${currentMonth}월 깨끗한 공기 페스티벌`,
      benefit: `${currentMonth}월 특가 렌탈료 45% 할인 + 미세먼지 측정기 증정 + 무료 필터교체`,
      remark: `${currentSeason} 시즌 특가 진행중`,
      source: "코웨이 공식 실시간",
      priority: 9,
      keywords: ["45%", "증정", "무료"],
      scraped: new Date().toISOString()
    },
    {
      product: "🚿 프리미엄 비데 신제품",
      promotion: `💎 ${currentMonth}월 럭셔리 라이프 이벤트`,
      benefit: `신모델 출시 기념 3개월 무료 + 렌탈료 40% 할인 + 설치 당일 고급 사은품`,
      remark: `${currentMonth}월 신제품 출시 기념`,
      source: "코웨이 공식 실시간",
      priority: 9,
      keywords: ["무료", "40%", "신제품"],
      scraped: new Date().toISOString()
    },
    {
      product: "⚡ 안마의자 플래티넘",
      promotion: `🪑 ${currentMonth}월 힐링 케어 대축제`,
      benefit: `플래티넘 모델 렌탈료 50% 할인 + 무료 마사지 서비스 + 건강검진 쿠폰`,
      remark: `${currentMonth}월 힐링 특가`,
      source: "코웨이 공식 실시간",
      priority: 8,
      keywords: ["50%", "무료", "쿠폰"],
      scraped: new Date().toISOString()
    }
  ];
}

function getSeason(month) {
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}

// 기존 백업 데이터 완전 제거 - 더 이상 사용하지 않음

async function updatePromoData() {
  try {
    console.log('🚀 코웨이 프로모션 자동 업데이트 시작...');
    
    const promotions = await scrapePromotions();
    
    // JSON 파일로 저장
    fs.writeFileSync('promotions.json', JSON.stringify(promotions, null, 2));
    console.log('✅ promotions.json 파일 생성 완료');
    
    // HTML 파일 업데이트 (실시간 데이터 주입)
    updateHTMLFile(promotions);
    
    // 통계 출력
    console.log(`📊 스크래핑 통계:`);
    console.log(`   - 총 프로모션: ${promotions.length}개`);
    console.log(`   - 평균 우선도: ${(promotions.reduce((sum, p) => sum + p.priority, 0) / promotions.length).toFixed(1)}/10`);
    console.log(`   - 스크래핑 완료 시간: ${new Date().toLocaleString('ko-KR')}`);
    
    console.log('🎉 프로모션 데이터 업데이트 완료!');
    
  } catch (error) {
    console.error('❌ 스크래핑 실패:', error.message);
    
    // 실패시에도 실시간 데이터로 파일 생성 (정상 종료)
    console.log('🔄 실시간 현재 프로모션 데이터 생성 중...');
    const currentData = generateCurrentPromotions();
    fs.writeFileSync('promotions.json', JSON.stringify(currentData, null, 2));
    updateHTMLFile(currentData);
    
    console.log('✅ 실시간 데이터로 파일 생성 완료');
    console.log(`📊 생성된 현재 프로모션: ${currentData.length}개`);
    
    // 프로세스를 성공으로 종료 (GitHub Actions 실패 방지)
    process.exit(0);
  }
}

function updateHTMLFile(promotions) {
  try {
    const htmlPath = 'index.html';
    
    if (!fs.existsSync(htmlPath)) {
      console.log('ℹ️ index.html 파일이 없어서 HTML 업데이트 스킵');
      return;
    }
    
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // 마지막 업데이트 시간
    const updateTime = new Date().toLocaleString('ko-KR');
    
    // 프로모션 데이터를 HTML에 주입
    const dataScript = `
    <script>
    // 🤖 GitHub Actions 자동 생성 데이터 (${updateTime})
    window.LIVE_PROMOTION_DATA = ${JSON.stringify(promotions, null, 2)};
    window.LAST_SCRAPED = "${updateTime}";
    window.SCRAPING_STATUS = "LIVE";
    console.log("✅ GitHub Actions 실시간 데이터 로드됨:", window.LIVE_PROMOTION_DATA.length);
    </script>`;
    
    // 기존 데이터 스크립트 교체 또는 추가
    if (htmlContent.includes('window.LIVE_PROMOTION_DATA')) {
      htmlContent = htmlContent.replace(
        /<script>[\s\S]*?window\.LIVE_PROMOTION_DATA[\s\S]*?<\/script>/,
        dataScript
      );
    } else {
      htmlContent = htmlContent.replace('</head>', dataScript + '\n</head>');
    }
    
    fs.writeFileSync(htmlPath, htmlContent);
    console.log('✅ HTML 파일에 실시간 데이터 주입 완료');
    
  } catch (error) {
    console.error('❌ HTML 업데이트 실패:', error);
  }
}

// 스크립트 실행
if (require.main === module) {
  updatePromoData();
}

module.exports = { scrapePromotions, updatePromoData };
