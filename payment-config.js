/* SGC Network V2 — payment gateway configuration
   Paste the LIVE Paystack Payment Page URLs you create in Paystack Dashboard.
   Do not put secret API keys in this file.
*/
window.SGC_PAYMENTS = {
  r20: 'PASTE_R20_PAYMENT_PAGE_URL',
  start: 'PASTE_SGC_START_SUBSCRIPTION_URL',
  kits: {
    'Beauty Business Kit': 'PASTE_BEAUTY_KIT_URL',
    'Finance Business Kit': 'PASTE_FINANCE_KIT_URL',
    'Clothing Brand Kit': 'PASTE_CLOTHING_KIT_URL',
    'Baking Business Kit': 'PASTE_BAKING_KIT_URL',
    'Social Media Business Kit': 'PASTE_SOCIAL_MEDIA_KIT_URL',
    'Cleaning Business Kit': 'PASTE_CLEANING_KIT_URL',
    'Car Wash Business Kit': 'PASTE_CAR_WASH_KIT_URL',
    'Digital Services Kit': 'PASTE_DIGITAL_SERVICES_KIT_URL',
    'Online Store Kit': 'PASTE_ONLINE_STORE_KIT_URL',
    'Gaming / RP Startup Kit': 'PASTE_GAMING_RP_KIT_URL',
    'Content Editing / Creative Services Kit': 'PASTE_CONTENT_EDITING_KIT_URL'
  },
  layby: 'PASTE_KIT_LAYBY_PAYMENT_URL'
};

function sgcPay(url, label) {
  if (!url || url.startsWith('PASTE_')) {
    alert('This payment button is ready for Paystack, but its Paystack Payment Page link has not been added yet.');
    return;
  }
  window.location.href = url;
}
