export const TEMPLATES = {
    'order_confirmation_ar': {
        name: 'order_confirmation_ar',
        language: 'ar',
        content: `#BUT{{orderid}} تأكيد طلب
أزيك يا {{name}}! 🐥

🐥 طلبك: #BUT{{orderid}} 

🚚 هيوصل على: {{address}}

💰 الإجمالي: {{price}} جنيه

مُسعد البطة بيشكرك على طلبك من Lazybut بالنيابة عن كل البط. 🐥

كنا عايزين نأكد طلبك قبل ما نشحنه
عايز تأكّد الطلب؟✅`
    },

    'order_confirmation': {
        name: 'order_confirmation',
        language: 'en',
        content: `#BUT{{orderid}} Order Confirmation
Hello {{name}}! 🐥

🐥 Order: #BUT{{orderid}}

🚚 Shipping Address: {{address}}

💰 Total Price: {{price}} EGP

Mosaad Al-Duck thanks you on behalf of all the ducks for ordering from Lazybut 💛

I just wanted to confirm your order before shipping it out 

Do you want to confirm? ✅`
    },

    'order_cancellation_en': {
        name: 'order_cancellation_en',
        language: 'en',
        content: `Do you want to cancel the order or edit it only?`
    },

    'order_cancellation_ar': {
        name: 'order_cancellation_ar',
        language: 'en',
        content: `
عايز تلغي الاوردر ولا تعدله؟`
    },

    'order_shipping_en': {
        name: 'order_shipping_en',
        language: 'en',
        content: `Order Confirmed!
Alright great!🐥
Orders take 2 - 7 Business Days (excluding weekends and holidays), so expect a call from the courier within this period 🐥

Please read our shipping and cancellation policy from here: https://lazybut.net/policies/shipping-policy 🐥 

⚠️ Please note: The shipping company only allows 3 rescheduling attempts. If the order isn’t delivered within 8 days, it will be automatically canceled. So if you’d like to adjust the delivery date in advance, just let us know to avoid any issues 🐥

Thank you 🐥`
    },

    'order_shipping_ar ': {
        name: 'order_shipping_ar ',
        language: 'ar',
        content: `
الطلب اتأكد!
تمام يا {{name}}! 🐥

الطلبات بتاخد من 2 لـ 7 أيام عمل (ماعدا اجازة نهاية الاسبوع والعطلات)، فاستنّى مكالمة من شركة الشحن خلال الفترة دي 🐥

ممكن تطّلع على سياسة الشحن والإلغاء من هنا:

https://lazybut.net/policies/shipping-policy🐥

⚠️ خد بالك إن شركة الشحن بتديك 3 محاولات بس علشان تأجّل استلام الشحنة قبل ما يتلغى الطلب أوتوماتيك، وكمان الطلب بيقعد معاهم بحد أقصى 8 أيام.
يعني لو مش متاح تستلمه أو حابب تغيّر معاد الاستلام من دلوقتي عشان نتفادى أي مشاكل، ياريت تبلغنا 🐥

شكرًا ليك 🐥`
    },
    'missing_location': {
        name: 'Missing Location ',
        language: 'en',
        content: `Sorry there was a problem with your address, can you write it again and send it here please? 🐥🐥`
    },    'order_reconfirm_en': {
        name: 'order_reconfirm_en',
        language: 'en',
        content: `Just a friendly reminder that your order hasn’t been confirmed yet 🐥 
\n
We won’t be able to ship your order until it’s confirmed.`
    },
    'Last Template ': {
        name: 'Last Template ',
        language: 'en',
        content: `I just have this because the last template isn't being recognized`
    },

    // Add more templates as needed
};

export function getTemplateContent(templateName, variables = {}) {
    const template = TEMPLATES[templateName];

    if (!template) {
        return `Template: ${templateName}`;
    }

    let content = template.content;

    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
        content = content.replace(new RegExp(`{${key}}`, 'g'), value || '');
    });

    return content;
}