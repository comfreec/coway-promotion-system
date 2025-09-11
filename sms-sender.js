// sms-sender.js - 코웨이 프로모션 SMS 발송 시스템
const axios = require('axios');
const fs = require('fs');

// CoolSMS API 설정 (환경변수로 관리 권장)
const SMS_CONFIG = {
  apiKey: process.env.COOLSMS_API_KEY || 'YOUR_API_KEY',
  apiSecret: process.env.COOLSMS_API_SECRET || 'YOUR_API_SECRET',
  sender: process.env.SMS_SENDER || '01012345678', // 발신번호
  baseUrl: 'https://api.coolsms.co.kr/messages/v4/send'
};

// 고객 데이터베이스 (실제로는 DB나 파일로 관리)
const CUSTOMER_DB = [
  { name: '김고객', phone: '01012345678', interests: ['정수기', '공기청정기'] },
  { name: '박고객', phone: '01098765432', interests: ['비데', '매트리스'] },
  { name: '이고객', phone: '01055555555', interests: ['제휴카드', '렌탈'] }
];

/**
 * 프로모션 데이터를 SMS 메시지로 변환
 */
function createSMSMessage(promotions, customerName = '') {
  const greeting = customerName ? `${customerName}님, ` : '';
  
  // 상위 3개 프로모션만 선택 (SMS 길이 제한)
  const topPromotions = promotions.slice(0, 3);
  
  let message = `${greeting}🏠 코웨이 특별 프로모션 알림!\n\n`;
  
  topPromotions.forEach((promo, index) => {
    const priority = promo.priority >= 10 ? '🔥HOT' : promo.priority >= 8 ? '✨NEW' : '💰';
    message += `${priority} ${promo.product.replace(/[⭐🧊💨⚡🌟🌪️🛏️💳🌸🔥👕💧🏠👶🎓🏢🎊🎯]/g, '')}\n`;
    message += `${promo.benefit.substring(0, 40)}...\n`;
    if (index < topPromotions.length - 1) message += '\n';
  });
  
  message += `\n📱 전체보기: https://comfreec.github.io/coway-promotion-system/`;
  message += `\n📞 상담문의: 1588-7997`;
  message += `\n\n수신거부: STOP 회신`;
  
  return message;
}

/**
 * 개별 고객 맞춤 메시지 생성
 */
function createPersonalizedMessage(promotions, customer) {
  // 고객 관심사에 맞는 프로모션 필터링
  const personalizedPromotions = promotions.filter(promo => 
    customer.interests.some(interest => 
      promo.product.toLowerCase().includes(interest.toLowerCase()) ||
      promo.benefit.toLowerCase().includes(interest.toLowerCase())
    )
  );
  
  // 맞춤 프로모션이 있으면 우선 표시, 없으면 상위 프로모션 표시
  const finalPromotions = personalizedPromotions.length > 0 
    ? personalizedPromotions.slice(0, 3)
    : promotions.slice(0, 3);
  
  let message = `${customer.name}님께 특별히 추천! 🎯\n\n`;
  
  finalPromotions.forEach((promo, index) => {
    const isPersonalized = personalizedPromotions.includes(promo);
    const emoji = isPersonalized ? '💎맞춤' : '🔥인기';
    
    message += `${emoji} ${promo.product.replace(/[⭐🧊💨⚡🌟🌪️🛏️💳🌸🔥👕💧🏠👶🎓🏢🎊🎯]/g, '')}\n`;
    message += `${promo.benefit.substring(0, 35)}...\n`;
    if (index < finalPromotions.length - 1) message += '\n';
  });
  
  message += `\n🎁 ${customer.name}님 전용 추가혜택 문의`;
  message += `\n📱 https://comfreec.github.io/coway-promotion-system/`;
  message += `\n📞 1588-7997 (${customer.name}님 전용라인)`;
  
  return message;
}

/**
 * CoolSMS API를 통한 SMS 발송
 */
async function sendSMS(to, message, from = SMS_CONFIG.sender) {
  try {
    const data = {
      message: {
        to: to,
        from: from,
        text: message,
        type: 'SMS',
        country: '82'
      }
    };
    
    const response = await axios.post(SMS_CONFIG.baseUrl, data, {
      headers: {
        'Authorization': `HMAC-SHA256 apiKey=${SMS_CONFIG.apiKey}, date=${new Date().toISOString()}, salt=${Date.now()}, signature=${generateSignature()}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      messageId: response.data.groupId,
      message: '문자 발송 성공'
    };
  } catch (error) {
    console.error('SMS 발송 실패:', error.message);
    return {
      success: false,
      error: error.message,
      message: '문자 발송 실패'
    };
  }
}

/**
 * HMAC 서명 생성 (CoolSMS 인증용)
 */
function generateSignature() {
  const crypto = require('crypto');
  const date = new Date().toISOString();
  const salt = Date.now().toString();
  const data = date + salt;
  
  return crypto
    .createHmac('sha256', SMS_CONFIG.apiSecret)
    .update(data)
    .digest('hex');
}

/**
 * 단체 문자 발송
 */
async function sendBulkSMS(promotions, recipients = CUSTOMER_DB) {
  console.log(`📱 ${recipients.length}명에게 프로모션 문자 발송 시작...`);
  
  const results = [];
  
  for (const customer of recipients) {
    try {
      const message = createPersonalizedMessage(promotions, customer);
      const result = await sendSMS(customer.phone, message);
      
      results.push({
        customer: customer.name,
        phone: customer.phone,
        ...result
      });
      
      console.log(`✅ ${customer.name}님 발송 ${result.success ? '성공' : '실패'}`);
      
      // API 호출 제한을 위한 딜레이
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ ${customer.name}님 발송 실패:`, error.message);
      results.push({
        customer: customer.name,
        phone: customer.phone,
        success: false,
        error: error.message
      });
    }
  }
  
  // 발송 결과 저장
  const reportData = {
    timestamp: new Date().toISOString(),
    totalSent: results.filter(r => r.success).length,
    totalFailed: results.filter(r => !r.success).length,
    results: results
  };
  
  fs.writeFileSync('sms-report.json', JSON.stringify(reportData, null, 2));
  
  console.log(`📊 발송 완료: 성공 ${reportData.totalSent}건, 실패 ${reportData.totalFailed}건`);
  return reportData;
}

/**
 * 신규 프로모션 자동 알림
 */
async function sendNewPromotionAlert(newPromotions) {
  if (newPromotions.length === 0) return;
  
  console.log(`🚨 신규 프로모션 ${newPromotions.length}개 발견! 긴급 알림 발송`);
  
  const urgentMessage = `🚨 코웨이 긴급 특가!\n\n` +
    newPromotions.slice(0, 2).map(promo => 
      `🔥 ${promo.product}\n${promo.benefit.substring(0, 30)}...`
    ).join('\n\n') +
    `\n\n⏰ 한정수량! 지금 확인하세요\n📱 https://comfreec.github.io/coway-promotion-system/`;
  
  // VIP 고객에게만 먼저 발송
  const vipCustomers = CUSTOMER_DB.slice(0, 2);
  
  for (const customer of vipCustomers) {
    await sendSMS(customer.phone, urgentMessage);
    console.log(`🎯 VIP ${customer.name}님에게 긴급 알림 발송`);
  }
}

/**
 * 웹훅으로 SMS 발송 요청 처리
 */
async function handleSMSRequest(req, res) {
  try {
    const { phone, customerName, promotionIds } = req.body;
    
    // 프로모션 데이터 로드
    const promotions = JSON.parse(fs.readFileSync('promotions.json', 'utf8'));
    
    // 특정 프로모션만 선택 (선택적)
    const selectedPromotions = promotionIds 
      ? promotions.filter((_, index) => promotionIds.includes(index))
      : promotions;
    
    const message = createSMSMessage(selectedPromotions, customerName);
    const result = await sendSMS(phone, message);
    
    res.json({
      success: result.success,
      message: result.message,
      messagePreview: message
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 주간 정기 알림 발송
 */
async function sendWeeklyUpdate(promotions) {
  console.log('📅 주간 정기 프로모션 알림 발송');
  
  const weeklyMessage = `📅 이번 주 코웨이 베스트 프로모션!\n\n` +
    promotions.slice(0, 3).map((promo, index) => 
      `${index + 1}. ${promo.product.replace(/[⭐🧊💨⚡🌟🌪️🛏️💳🌸🔥👕💧🏠👶🎓🏢🎊🎯]/g, '')}\n` +
      `   ${promo.benefit.substring(0, 35)}...`
    ).join('\n\n') +
    `\n\n🔥 이번 주만 특가! 놓치지 마세요\n📱 https://comfreec.github.io/coway-promotion-system/`;
  
  return await sendBulkSMS(promotions, CUSTOMER_DB, weeklyMessage);
}

/**
 * 개인 맞춤 알림 발송
 */
async function sendPersonalizedUpdate(promotions) {
  console.log('🎯 고객 맞춤 프로모션 알림 발송');
  
  const results = [];
  for (const customer of CUSTOMER_DB) {
    const personalizedMessage = createPersonalizedMessage(promotions, customer);
    const result = await sendSMS(customer.phone, personalizedMessage);
    results.push({ customer: customer.name, ...result });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * 긴급 프로모션 알림
 */
async function sendEmergencyAlert(promotions) {
  console.log('🚨 긴급 프로모션 알림 발송');
  
  // 우선순위 10 이상인 프로모션만 필터링
  const urgentPromotions = promotions.filter(p => p.priority >= 10);
  
  if (urgentPromotions.length === 0) {
    console.log('📢 긴급 발송할 프로모션이 없습니다.');
    return;
  }
  
  const urgentMessage = `🚨 긴급! 코웨이 특가 알림\n\n` +
    urgentPromotions.slice(0, 2).map(promo => 
      `🔥 ${promo.product.replace(/[⭐🧊💨⚡🌟🌪️🛏️💳🌸🔥👕💧🏠👶🎓🏢🎊🎯]/g, '')}\n` +
      `${promo.benefit.substring(0, 40)}...`
    ).join('\n\n') +
    `\n\n⏰ 한정 수량! 지금 바로 확인\n📞 1588-7997 (긴급 상담라인)`;
  
  // VIP 고객에게만 발송
  const vipCustomers = CUSTOMER_DB.slice(0, Math.min(2, CUSTOMER_DB.length));
  
  for (const customer of vipCustomers) {
    await sendSMS(customer.phone, urgentMessage);
    console.log(`🎯 VIP ${customer.name}님에게 긴급 알림 발송`);
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    console.log('📱 코웨이 프로모션 SMS 발송 시스템 시작');
    
    // 프로모션 데이터 로드
    const promotions = JSON.parse(fs.readFileSync('promotions.json', 'utf8'));
    
    if (process.argv.includes('--bulk')) {
      // 단체 발송
      await sendBulkSMS(promotions);
    } else if (process.argv.includes('--test')) {
      // 테스트 발송
      const testMessage = createSMSMessage(promotions.slice(0, 2), '테스트고객');
      console.log('📝 테스트 메시지 미리보기:');
      console.log(testMessage);
      console.log('\n📏 메시지 길이:', testMessage.length, '자');
    } else if (process.argv.includes('--weekly')) {
      // 주간 정기 알림
      await sendWeeklyUpdate(promotions);
    } else if (process.argv.includes('--personalized')) {
      // 개인 맞춤 알림
      await sendPersonalizedUpdate(promotions);
    } else if (process.argv.includes('--emergency')) {
      // 긴급 알림
      await sendEmergencyAlert(promotions);
    } else {
      console.log('사용법:');
      console.log('  node sms-sender.js --bulk         # 전체 고객 발송');
      console.log('  node sms-sender.js --test         # 메시지 미리보기');
      console.log('  node sms-sender.js --weekly       # 주간 정기 알림');
      console.log('  node sms-sender.js --personalized # 개인 맞춤 알림');
      console.log('  node sms-sender.js --emergency    # 긴급 프로모션 알림');
    }
    
  } catch (error) {
    console.error('❌ SMS 발송 시스템 오류:', error.message);
  }
}

module.exports = {
  sendSMS,
  sendBulkSMS,
  createSMSMessage,
  createPersonalizedMessage,
  sendNewPromotionAlert,
  handleSMSRequest
};

// 스크립트 직접 실행시
if (require.main === module) {
  main();
}