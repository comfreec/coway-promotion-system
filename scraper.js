import puppeteer from "puppeteer";

const scrapePromotion = async (target) => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log("페이지 이동 시작:", target.url);

    // page.goto는 DOMContentLoaded까지만 기다리도록 제한
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 15000 });

    // 프로모션 요소 뜰 때까지만 기다림
    await page.waitForSelector(target.selector, { timeout: 10000 });

    console.log("프로모션 영역 발견됨");

    // 필요한 데이터 가져오기
    const promotionData = await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      return el ? el.innerText.trim() : null;
    }, target.selector);

    console.log("추출 완료:", promotionData);
    return promotionData;

  } catch (err) {
    console.error("스크래핑 실패:", err.message);
    return null;
  } finally {
    await browser.close();
  }
};

// 실행 예시
const target = {
  url: "https://example.com/promotion",
  selector: ".promotion-banner" // 실제 CSS 셀렉터 넣어야 함
};

scrapePromotion(target).then((data) => {
  console.log("최종 결과:", data);
});
