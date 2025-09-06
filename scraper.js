// scraper.js - 코웨이 프로모션 자동 스크래핑 (강화 버전)
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
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  
  const allPromotions = [];
  
  for (const target of SCRAPE_TARGETS) {
    try {
      console.log(`📡 ${target.name} 스크래핑 중...`);
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // 타임아웃 연장 및 네트워크 대기
      await page.goto(target.url, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });
      
      // 페이지 로딩 및 동적 컨텐츠 대기
      await page.waitForTimeout(5000);
      
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
