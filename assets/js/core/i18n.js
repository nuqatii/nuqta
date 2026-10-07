// Arabic / English strings. t('key', {vars}) — missing keys fall back to English, then to the key.
import { CONFIG } from '../config.js';

const en = {
  // shell
  app_tagline: 'Loyalty cards and customer lists for local businesses',
  nav_dashboard: 'Home', nav_checkout: 'Checkout', nav_customers: 'Customers', nav_transactions: 'Activity',
  nav_rewards: 'Rewards', nav_program: 'Loyalty program', nav_designer: 'Card designer', nav_crm: 'Segments',
  nav_campaigns: 'Campaigns', nav_analytics: 'Analytics', nav_locations: 'Locations', nav_staff: 'Team',
  nav_settings: 'Settings', nav_qr: 'Join QR & poster', nav_more: 'More', nav_signout: 'Sign out',
  nav_group_daily: 'Every day', nav_group_grow: 'Grow', nav_group_setup: 'Set up',
  demo_banner: 'Demo mode — data lives in this browser only.', demo_reset: 'Reset demo data', switch_lang: 'العربية',
  loading: 'Loading…', save: 'Save', saved: 'Saved', cancel: 'Cancel', close: 'Close', delete: 'Delete', deleted: 'Deleted',
  edit: 'Edit', add: 'Add', back: 'Back', next: 'Next', done: 'Done', search: 'Search', copy: 'Copy', copied: 'Copied',
  download: 'Download', print: 'Print', share: 'Share', optional: 'optional', all: 'All', none: 'None', yes: 'Yes', no: 'No',
  active: 'Active', inactive: 'Inactive', export_csv: 'Export CSV', view_all: 'View all', confirm: 'Confirm',
  // auth
  signin_title: 'Sign in to your business', signup_title: 'Create your business account',
  email: 'Email', password: 'Password', your_name: 'Your name', signin: 'Sign in', signup: 'Create account',
  have_account: 'Already have an account?', no_account: 'New here?', forgot: 'Forgot password?',
  reset_sent: 'Check your email for a reset link.', try_demo: 'Explore the demo',
  demo_accounts: 'Demo sign-ins', demo_pw: 'Password for all: demo1234',
  role_owner: 'Owner', role_manager: 'Manager', role_staff: 'Cashier', role_marketing: 'Marketing',
  role_owner_d: 'Full access, including team and settings.', role_manager_d: 'Customers, checkout, rewards and analytics.',
  role_staff_d: 'Find customers and record purchases.', role_marketing_d: 'Segments, campaigns and analytics.',
  pick_business: 'Choose a business', new_business: 'Add another business', admin_console: 'Platform admin',
  // errors
  'err_auth/invalid-credential': 'That email and password don’t match. Check both and try again.',
  'err_auth/email-already-in-use': 'That email already has an account. Sign in instead.',
  'err_auth/weak-password': 'Use at least 6 characters for the password.',
  'err_auth/invalid-email': 'Enter a valid email address.',
  'err_auth/demo-no-email': 'Password reset sends an email, which only works with Firebase.',
  'err_permission-denied': 'Your role can’t do that. Ask the owner to change your access.',
  'err_invalid-phone': 'Enter a mobile number, for example 0944 123 456.',
  'err_invalid-email': 'Enter a valid email address, or leave it empty.',
  'err_invalid-name': 'Enter a name.',
  'err_already-member': 'This phone number is already a member.',
  'err_invalid-amount': 'Enter the purchase amount.',
  'err_code-not-found': 'No reward code matches. Check the letters and numbers.',
  'err_code-used': 'This code was already used.',
  'err_code-expired': 'This code expired. Ask the customer to tap Redeem again.',
  'err_code-cancelled': 'This code was cancelled.',
  'err_insufficient-points': 'Not enough points for this reward yet.',
  'err_reward-unavailable': 'This reward is switched off or expired.',
  'err_business-suspended': 'This business is paused. Contact support.',
  'err_not-found': 'Not found.',
  'err_signups-closed': 'New businesses can’t sign up right now. Contact support.',
  'err_cannot-change-owner': 'The owner’s access can’t be changed here.',
  err_generic: 'Something went wrong: {msg}',
  // onboarding
  ob_title: 'Set up your loyalty program', ob_sub: 'Seven short steps. You can change everything later.',
  ob_step: 'Step {n} of {total}', ob_name: 'What’s your business called?', ob_name_ph: 'e.g. Joe’s Pizza',
  ob_type: 'What kind of business is it?', ob_logo: 'Add your logo', ob_logo_hint: 'A square image works best. You can skip this.',
  ob_upload: 'Upload logo', ob_skip: 'Skip for now', ob_colors: 'Pick your brand colours',
  ob_program: 'How do customers earn?', ob_reward: 'Create the first reward', ob_finish: 'Create my program',
  ob_ready: 'Your loyalty program is ready.', ob_ready_sub: 'Print the QR code and put it where customers wait.',
  ob_go_dashboard: 'Go to dashboard', ob_add_first: 'Add your first customer',
  bt_restaurant: 'Restaurant', bt_cafe: 'Café', bt_retail: 'Retail', bt_salon: 'Salon', bt_gym: 'Gym',
  bt_beauty: 'Beauty', bt_grocery: 'Grocery', bt_other: 'Other',
  pt_points: 'Points', pt_points_d: 'Customers earn points for every amount spent.',
  pt_visits: 'Visits', pt_visits_d: 'Every visit counts, whatever they spend.',
  pt_stamps: 'Stamps', pt_stamps_d: 'One stamp per item — buy 9, get the 10th free.',
  pt_spend: 'Spend', pt_spend_d: 'Spend a set amount to unlock a reward.',
  rule_points: '{earn} point for every {per} {cur}', rule_visits: '1 visit counted per purchase',
  rule_stamps: '1 stamp per item', rule_spend: 'Every {per} {cur} spent counts towards rewards',
  u_points: 'points', u_visits: 'visits', u_stamps: 'stamps', u_spend: '{cur}',
  // dashboard
  dash_hello: 'Good to see you, {name}', dash_today: 'Today at {biz}',
  k_customers: 'Members', k_new: 'New this week', k_revenue: 'Revenue (30 days)', k_points: 'Points issued (30 days)', k_redeemed: 'Rewards redeemed (30 days)',
  growth_chart: 'Members over time', revenue_chart: 'Revenue by week', loyalty_activity: 'Loyalty activity',
  top_customers: 'Top customers', popular_rewards: 'Popular rewards', recent_tx: 'Recent activity',
  times_redeemed: '{n} redeemed', vs_prev_week: 'vs previous week', col_business: 'Business', col_type: 'Type',
  ad_revenue_all: 'Purchases recorded (all time)', ad_points_all: 'Points issued (all time)', earned_pts: 'Earned', redeemed_pts: 'Redeemed', vs_prev: 'vs previous 30 days',
  quick_checkout: 'Start checkout', no_data_yet: 'Nothing here yet. Record a purchase to see it fill in.',
  // checkout
  co_title: 'Checkout', co_find: 'Find the customer', co_find_ph: 'Phone, member number, or scan the card',
  co_scan: 'Scan card', co_scan_stop: 'Stop camera', co_scan_hint: 'Point the camera at the QR code on the customer’s phone.',
  co_camera_error: 'The camera isn’t available. Type the phone number instead.',
  co_amount: 'Purchase amount', co_qty: 'Items', co_complete: 'Add points', co_new_sale: 'Next customer',
  co_earned: '+{n} {unit}', co_balance: 'Balance: {n}', co_unlocked: 'Reward unlocked: {r}', co_tierup: 'Moved up to {t}',
  co_verify: 'Verify a reward code', co_verify_ph: 'R-XXXXXX', co_verify_btn: 'Check & redeem', co_redeemed: '{r} redeemed. New balance: {n}.',
  co_tab_sale: 'Add purchase', co_tab_code: 'Reward code', co_no_match: 'No member matches “{q}”.', co_add_instead: 'Add as new member',
  co_redeem_now: 'Redeem a reward now', co_can_redeem: 'Can redeem', co_pending: 'Codes waiting',
  co_will_earn: 'Will earn {n} {unit}', co_member_since: 'Member since {d}', co_last_visit: 'Last visit {d}', co_never: 'No visits yet',
  // customers
  cu_title: 'Customers', cu_add: 'Add customer', cu_search_ph: 'Search name, phone, email or member number',
  cu_count: '{n} customers', cu_empty: 'No customers yet. Share your join QR or add one here.',
  first_name: 'First name', last_name: 'Last name', phone: 'Phone', birthday: 'Birthday', gender: 'Gender',
  notes: 'Notes', marketing_consent: 'Agrees to receive offers', preferred_channel: 'Preferred channel',
  joined: 'Joined', last_visit: 'Last visit', visits: 'Visits', total_spend: 'Total spent', points: 'Points',
  lifetime_points: 'Lifetime points', tier: 'Tier', rewards_redeemed: 'Rewards redeemed', avg_tx: 'Average purchase',
  member_no: 'Member no.', status: 'Status', timeline: 'Timeline', adjust_points: 'Adjust points',
  adjust_hint: 'Use a negative number to remove points.', reason: 'Reason', send_card: 'Send card link',
  open_card: 'Open card', customer_added: 'Customer added', gender_f: 'Female', gender_m: 'Male',
  ev_join: 'Joined the program', ev_purchase: 'Purchase', ev_redeem: 'Redeemed {r}', ev_adjust: 'Points adjusted', ev_tier: 'Reached {r}',
  by_staff: 'by {s}', welcome_bonus_ev: 'Welcome bonus',
  // segments
  seg_new: 'New', seg_active: 'Active', seg_loyal: 'Loyal', seg_vip: 'VIP', seg_at_risk: 'At risk', seg_inactive: 'Inactive',
  seg_new_d: 'Joined in the last 14 days', seg_active_d: 'Visited in the last 30 days', seg_loyal_d: '5+ visits and still coming',
  seg_vip_d: 'In your top tier', seg_at_risk_d: 'No visit for 30–60 days', seg_inactive_d: 'No visit for 60+ days',
  crm_title: 'Segments', crm_auto: 'Automatic groups', crm_custom: 'Your segments', crm_new: 'New segment',
  crm_rules: 'Customers where…', crm_add_rule: 'Add condition', crm_matches: '{n} customers match',
  crm_returning: 'Returning (2+ visits)', crm_presets: 'Ready-made',
  f_daysSinceVisit: 'Days since last visit', f_joinedDaysAgo: 'Days since joining', f_spend: 'Total spent', f_points: 'Points balance',
  f_lifetimePoints: 'Lifetime points', f_visits: 'Visits', f_redeemedCount: 'Rewards redeemed', f_tierId: 'Tier', f_birthdayMonth: 'Birthday month',
  op_gt: 'more than', op_gte: 'at least', op_lt: 'less than', op_lte: 'at most', op_eq: 'is', op_neq: 'is not',
  // rewards
  rw_title: 'Rewards', rw_add: 'New reward', rw_name: 'Reward name', rw_name_ar: 'Name in Arabic', rw_desc: 'Description',
  rw_cost: 'Cost', rw_value: 'Value', rw_expires: 'Expires', rw_min: 'Minimum purchase', rw_limit: 'Total usage limit',
  rw_limit_hint: '0 means no limit', rw_on: 'Customers can redeem it', rw_empty: 'No rewards yet. Add one so members have something to aim for.',
  rw_image: 'Image', rw_saved: 'Reward saved', rw_redemptions: 'Recent redemptions',
  // program
  pg_title: 'Loyalty program', pg_type: 'Program type', pg_rule: 'Earning rule', pg_spend_each: 'For every', pg_give: 'give',
  pg_welcome: 'Welcome bonus', pg_welcome_hint: 'Given once when someone joins.', pg_tiers: 'Membership tiers',
  pg_tier_min: 'From (lifetime {unit})', pg_tier_benefits: 'Benefits', pg_add_tier: 'Add tier', pg_preview: 'Example',
  pg_example: 'A purchase of {amt} earns {n} {unit}.', pg_change_warn: 'Changing the program type keeps existing balances as they are.',
  pg_goal: 'Stamps on the card',
  // designer
  ds_title: 'Card designer', ds_style: 'Style', ds_layout: 'Layout', ds_colors: 'Colours', ds_bg: 'Card colour',
  ds_secondary: 'Accent', ds_text: 'Text', ds_primary: 'Brand colour', ds_program_name: 'Program name', ds_program_name_ar: 'Program name (Arabic)',
  ds_icon: 'Icon', ds_code: 'Code on card', ds_cover: 'Cover image', ds_logo: 'Logo', ds_remove: 'Remove',
  st_gradient: 'Gradient', st_solid: 'Solid', st_split: 'Two-tone', st_minimal: 'Light',
  ly_classic: 'Balance first', ly_centered: 'Centered', ly_stamps: 'Stamp grid',
  code_qr: 'QR code', code_barcode: 'Barcode', ds_preview_as: 'Preview with', ds_wallet_note: 'The card is laid out like an Apple/Google Wallet pass, so it can be added to phone wallets later.',
  // campaigns
  cp_title: 'Campaigns', cp_new: 'New campaign', cp_name: 'Campaign name', cp_segment: 'Send to', cp_channel: 'Channel',
  cp_message: 'Message', cp_vars: 'Insert', cp_preview: 'Preview for {name}', cp_prepare: 'Prepare recipients',
  cp_ready: 'Ready — {n} recipients', cp_draft: 'Draft', cp_recipients: '{n} people with consent',
  cp_note: 'Automatic WhatsApp, SMS and email sending connects here later. For now, open each chat with one tap or export the list.',
  cp_open_wa: 'Open WhatsApp', cp_empty: 'No campaigns yet. Pick a segment and write a short message.',
  cp_templates: 'Automatic messages', ch_whatsapp: 'WhatsApp', ch_sms: 'SMS', ch_email: 'Email', ch_push: 'Push',
  tp_welcome: 'Welcome', tp_reward_ready: 'Reward ready', tp_tier_up: 'Tier upgrade', tp_birthday: 'Birthday', tp_winback: 'Win-back',
  tp_hint: 'These send automatically once a messaging provider is connected.',
  // analytics
  an_title: 'Analytics', an_range: 'Last {n} days', an_by_dow: 'Busiest days', an_by_tier: 'Members by tier', an_by_segment: 'Members by group',
  an_by_staff: 'Purchases by team member', an_by_location: 'Revenue by location', an_return_rate: 'Return rate', an_return_rate_d: 'Members with 2+ visits',
  an_redemption_rate: 'Redemption rate', an_redemption_rate_d: 'Points spent ÷ points earned', an_avg_visits: 'Visits per member',
  // locations
  lc_title: 'Locations', lc_add: 'Add location', lc_name: 'Name', lc_address: 'Address', lc_hint: 'Purchases record which location they happened at.',
  // staff
  sf_title: 'Team', sf_invite: 'Invite someone', sf_invite_hint: 'They sign up with this email and get access automatically.',
  sf_pending: 'Invited', sf_role: 'Access', sf_you: 'you', sf_remove: 'Remove access', sf_invited: 'Invitation saved',
  // settings
  se_title: 'Settings', se_business: 'Business details', se_currency: 'Currency', se_language: 'Customer page language',
  se_plan: 'Plan', se_audit: 'Activity log', se_danger: 'Demo', se_join_link: 'Join link', se_card_url: 'Customer page',
  plan_free: 'Free', plan_starter: 'Starter', plan_professional: 'Professional', plan_enterprise: 'Enterprise',
  // QR
  qr_title: 'Join QR & poster', qr_sub: 'Customers scan this to join in under a minute.', qr_poster: 'Printable poster',
  qr_poster_h: 'Join our rewards', qr_poster_sub: 'Scan to earn {unit} every visit', qr_png: 'Download QR (PNG)', qr_svg: 'Download QR (SVG)',
  qr_where: 'Put it on tables, menus, receipts, the counter and packaging.', qr_print_poster: 'Print poster',
  // customer app
  join_title: 'Join {biz} rewards', join_sub: 'Earn {unit} every time you visit.', join_btn: 'Join now', join_consent: 'Send me offers on WhatsApp',
  join_welcome: 'Welcome to {program}!', join_exists: 'You’re already a member. Your card is saved on the phone you joined with — or ask the cashier to send it to you.',
  join_privacy: 'Your number is only shared with {biz}.', join_bonus: 'You get {n} {unit} just for joining.',
  c_card: 'Card', c_rewards: 'Rewards', c_activity: 'Activity', c_profile: 'Profile', c_points: 'Points',
  c_show_staff: 'Show this to the cashier', c_to_next: '{n} {unit} to {tier}', c_top_tier: 'You’re in the top tier',
  c_available: 'You can redeem', c_locked: 'Keep going', c_need_more: '{n} more {unit}', c_redeem: 'Redeem',
  c_code_title: 'Show this code to the cashier', c_code_exp: 'Valid until {t}', c_code_done: 'Used {d}',
  c_no_activity: 'Your visits will show up here.', c_save_card: 'Add to home screen to keep your card one tap away.',
  c_wallet_soon: 'Apple & Google Wallet coming soon', c_member: 'Member', c_tier_benefits: 'Your benefits',
  c_profile_saved: 'Profile saved', c_install: 'Add to home screen', c_card_missing: 'This card link isn’t valid. Ask the cashier to send it again.',
  c_open_codes: 'Your reward codes', c_rewards_count: '{n} rewards ready', c_stamps_left: '{n} more for your reward',
  c_paused: 'This program is paused right now.',
  // admin
  ad_title: 'Platform admin', ad_businesses: 'Businesses', ad_active: 'Active', ad_customers: 'Members (all)', ad_txns: 'Purchases',
  ad_redeemed: 'Redemptions', ad_new: 'New (30 days)', ad_suspend: 'Pause', ad_reactivate: 'Reactivate', ad_plan: 'Plan',
  ad_health: 'System', ad_settings: 'Platform settings', ad_signups: 'Allow new businesses to sign up', ad_announcement: 'Announcement for business owners',
  ad_privacy: 'Customer names and phone numbers are never shown here.', ad_last_active: 'Last activity', ad_mode: 'Backend', ad_not_admin: 'This account isn’t a platform admin.',
  ad_suspended: 'Paused', ad_usage: 'Usage',
  // time
  ago_now: 'just now', ago_m: '{n} min ago', ago_h: '{n} h ago', ago_d: '{n} days ago', yesterday: 'yesterday', today: 'today',
};

const ar = {
  app_tagline: 'بطاقات ولاء وقوائم زبائن للمحلات والمطاعم',
  nav_dashboard: 'الرئيسية', nav_checkout: 'الصندوق', nav_customers: 'الزبائن', nav_transactions: 'الحركات',
  nav_rewards: 'المكافآت', nav_program: 'برنامج الولاء', nav_designer: 'تصميم البطاقة', nav_crm: 'الشرائح',
  nav_campaigns: 'الحملات', nav_analytics: 'التحليلات', nav_locations: 'الفروع', nav_staff: 'الفريق',
  nav_settings: 'الإعدادات', nav_qr: 'رمز الانضمام والملصق', nav_more: 'المزيد', nav_signout: 'تسجيل الخروج',
  nav_group_daily: 'كل يوم', nav_group_grow: 'النمو', nav_group_setup: 'الإعداد',
  demo_banner: 'وضع تجريبي — البيانات محفوظة في هذا المتصفح فقط.', demo_reset: 'إعادة البيانات التجريبية', switch_lang: 'English',
  loading: 'جارٍ التحميل…', save: 'حفظ', saved: 'تم الحفظ', cancel: 'إلغاء', close: 'إغلاق', delete: 'حذف', deleted: 'تم الحذف',
  edit: 'تعديل', add: 'إضافة', back: 'رجوع', next: 'التالي', done: 'تم', search: 'بحث', copy: 'نسخ', copied: 'تم النسخ',
  download: 'تنزيل', print: 'طباعة', share: 'مشاركة', optional: 'اختياري', all: 'الكل', none: 'لا شيء', yes: 'نعم', no: 'لا',
  active: 'مفعّلة', inactive: 'متوقفة', export_csv: 'تصدير CSV', view_all: 'عرض الكل', confirm: 'تأكيد',
  signin_title: 'تسجيل الدخول إلى نشاطك', signup_title: 'إنشاء حساب لنشاطك التجاري',
  email: 'البريد الإلكتروني', password: 'كلمة المرور', your_name: 'اسمك', signin: 'دخول', signup: 'إنشاء الحساب',
  have_account: 'عندك حساب؟', no_account: 'جديد هنا؟', forgot: 'نسيت كلمة المرور؟',
  reset_sent: 'أرسلنا رابط إعادة التعيين إلى بريدك.', try_demo: 'جرّب النسخة التجريبية',
  demo_accounts: 'حسابات تجريبية', demo_pw: 'كلمة المرور للجميع: demo1234',
  role_owner: 'المالك', role_manager: 'مدير', role_staff: 'كاشير', role_marketing: 'تسويق',
  role_owner_d: 'صلاحيات كاملة، بما فيها الفريق والإعدادات.', role_manager_d: 'الزبائن والصندوق والمكافآت والتحليلات.',
  role_staff_d: 'البحث عن الزبائن وتسجيل المشتريات.', role_marketing_d: 'الشرائح والحملات والتحليلات.',
  pick_business: 'اختر النشاط', new_business: 'إضافة نشاط آخر', admin_console: 'إدارة المنصة',
  'err_auth/invalid-credential': 'البريد وكلمة المرور غير متطابقين. تحقق منهما وحاول مجدداً.',
  'err_auth/email-already-in-use': 'هذا البريد لديه حساب مسبقاً. سجّل الدخول بدلاً من ذلك.',
  'err_auth/weak-password': 'استخدم ٦ أحرف على الأقل لكلمة المرور.',
  'err_auth/invalid-email': 'أدخل بريداً إلكترونياً صحيحاً.',
  'err_auth/demo-no-email': 'إعادة تعيين كلمة المرور تحتاج بريداً، وهذا يعمل فقط مع Firebase.',
  'err_permission-denied': 'صلاحياتك لا تسمح بذلك. اطلب من المالك تعديلها.',
  'err_invalid-phone': 'أدخل رقم موبايل، مثل 0944 123 456.',
  'err_invalid-email': 'أدخل بريداً صحيحاً أو اتركه فارغاً.',
  'err_invalid-name': 'أدخل الاسم.',
  'err_already-member': 'هذا الرقم مشترك مسبقاً.',
  'err_invalid-amount': 'أدخل قيمة الفاتورة.',
  'err_code-not-found': 'لا يوجد رمز مكافأة مطابق. تحقق من الأحرف والأرقام.',
  'err_code-used': 'هذا الرمز مستخدم مسبقاً.',
  'err_code-expired': 'انتهت صلاحية الرمز. اطلب من الزبون الضغط على «استبدال» من جديد.',
  'err_code-cancelled': 'هذا الرمز ملغى.',
  'err_insufficient-points': 'الرصيد غير كافٍ لهذه المكافأة بعد.',
  'err_reward-unavailable': 'هذه المكافأة متوقفة أو منتهية.',
  'err_business-suspended': 'هذا النشاط موقوف مؤقتاً. تواصل مع الدعم.',
  'err_not-found': 'غير موجود.',
  'err_signups-closed': 'تسجيل الأنشطة الجديدة متوقف حالياً. تواصل مع الدعم.',
  'err_cannot-change-owner': 'لا يمكن تعديل صلاحيات المالك من هنا.',
  err_generic: 'حدث خطأ: {msg}',
  ob_title: 'جهّز برنامج الولاء', ob_sub: 'سبع خطوات قصيرة. تستطيع تغيير كل شيء لاحقاً.',
  ob_step: 'الخطوة {n} من {total}', ob_name: 'ما اسم نشاطك؟', ob_name_ph: 'مثلاً: مطعم الياسمين',
  ob_type: 'ما نوع النشاط؟', ob_logo: 'أضف الشعار', ob_logo_hint: 'الصورة المربعة أفضل. يمكنك التخطي.',
  ob_upload: 'رفع الشعار', ob_skip: 'تخطّ الآن', ob_colors: 'اختر ألوان علامتك',
  ob_program: 'كيف يكسب الزبائن؟', ob_reward: 'أنشئ أول مكافأة', ob_finish: 'أنشئ البرنامج',
  ob_ready: 'برنامج الولاء جاهز.', ob_ready_sub: 'اطبع رمز QR وضعه حيث ينتظر الزبائن.',
  ob_go_dashboard: 'إلى لوحة التحكم', ob_add_first: 'أضف أول زبون',
  bt_restaurant: 'مطعم', bt_cafe: 'مقهى', bt_retail: 'متجر', bt_salon: 'صالون', bt_gym: 'نادٍ رياضي',
  bt_beauty: 'تجميل', bt_grocery: 'بقالة', bt_other: 'أخرى',
  pt_points: 'نقاط', pt_points_d: 'يكسب الزبون نقاطاً حسب قيمة مشترياته.',
  pt_visits: 'زيارات', pt_visits_d: 'كل زيارة تُحسب مهما كانت قيمتها.',
  pt_stamps: 'أختام', pt_stamps_d: 'ختم لكل قطعة — اشترِ ٩ والعاشرة مجاناً.',
  pt_spend: 'إنفاق', pt_spend_d: 'أنفق مبلغاً محدداً لتحصل على مكافأة.',
  rule_points: '{earn} نقطة لكل {per} {cur}', rule_visits: 'زيارة واحدة لكل عملية شراء',
  rule_stamps: 'ختم لكل قطعة', rule_spend: 'كل {per} {cur} تُحسب نحو المكافآت',
  u_points: 'نقطة', u_visits: 'زيارة', u_stamps: 'ختم', u_spend: '{cur}',
  dash_hello: 'أهلاً {name}', dash_today: 'اليوم في {biz}',
  k_customers: 'الأعضاء', k_new: 'جدد هذا الأسبوع', k_revenue: 'المبيعات (٣٠ يوماً)', k_points: 'النقاط الممنوحة (٣٠ يوماً)', k_redeemed: 'المكافآت المستبدلة (٣٠ يوماً)',
  growth_chart: 'نمو الأعضاء', revenue_chart: 'المبيعات أسبوعياً', loyalty_activity: 'حركة الولاء',
  top_customers: 'أفضل الزبائن', popular_rewards: 'المكافآت الأكثر طلباً', recent_tx: 'آخر الحركات',
  times_redeemed: 'استُبدلت {n} مرة', vs_prev_week: 'مقارنة بالأسبوع السابق', col_business: 'النشاط', col_type: 'النوع',
  ad_revenue_all: 'قيمة المشتريات المسجلة (الكل)', ad_points_all: 'النقاط الممنوحة (الكل)', earned_pts: 'مكتسبة', redeemed_pts: 'مستبدلة', vs_prev: 'مقارنة بالـ٣٠ يوماً السابقة',
  quick_checkout: 'افتح الصندوق', no_data_yet: 'لا شيء بعد. سجّل عملية شراء لتظهر البيانات هنا.',
  co_title: 'الصندوق', co_find: 'ابحث عن الزبون', co_find_ph: 'رقم الموبايل أو رقم العضوية أو امسح البطاقة',
  co_scan: 'امسح البطاقة', co_scan_stop: 'إيقاف الكاميرا', co_scan_hint: 'وجّه الكاميرا نحو رمز QR على موبايل الزبون.',
  co_camera_error: 'الكاميرا غير متاحة. اكتب رقم الموبايل بدلاً من ذلك.',
  co_amount: 'قيمة الفاتورة', co_qty: 'عدد القطع', co_complete: 'أضف النقاط', co_new_sale: 'الزبون التالي',
  co_earned: '+{n} {unit}', co_balance: 'الرصيد: {n}', co_unlocked: 'أصبحت متاحة: {r}', co_tierup: 'ترقّى إلى {t}',
  co_verify: 'تحقق من رمز مكافأة', co_verify_ph: 'R-XXXXXX', co_verify_btn: 'تحقق واستبدل', co_redeemed: 'تم استبدال {r}. الرصيد الجديد: {n}.',
  co_tab_sale: 'إضافة شراء', co_tab_code: 'رمز مكافأة', co_no_match: 'لا يوجد عضو مطابق لـ «{q}».', co_add_instead: 'أضفه كعضو جديد',
  co_redeem_now: 'استبدل مكافأة الآن', co_can_redeem: 'يمكنه استبدال', co_pending: 'رموز بانتظار التحقق',
  co_will_earn: 'سيكسب {n} {unit}', co_member_since: 'عضو منذ {d}', co_last_visit: 'آخر زيارة {d}', co_never: 'لا زيارات بعد',
  cu_title: 'الزبائن', cu_add: 'إضافة زبون', cu_search_ph: 'ابحث بالاسم أو الموبايل أو البريد أو رقم العضوية',
  cu_count: '{n} زبون', cu_empty: 'لا زبائن بعد. شارك رمز الانضمام أو أضف زبوناً من هنا.',
  first_name: 'الاسم', last_name: 'الكنية', phone: 'الموبايل', birthday: 'تاريخ الميلاد', gender: 'الجنس',
  notes: 'ملاحظات', marketing_consent: 'يوافق على استلام العروض', preferred_channel: 'وسيلة التواصل المفضلة',
  joined: 'تاريخ الانضمام', last_visit: 'آخر زيارة', visits: 'الزيارات', total_spend: 'مجموع المشتريات', points: 'النقاط',
  lifetime_points: 'مجموع النقاط المكتسبة', tier: 'المستوى', rewards_redeemed: 'المكافآت المستبدلة', avg_tx: 'متوسط الفاتورة',
  member_no: 'رقم العضوية', status: 'الحالة', timeline: 'السجل', adjust_points: 'تعديل النقاط',
  adjust_hint: 'استخدم رقماً سالباً لخصم النقاط.', reason: 'السبب', send_card: 'أرسل رابط البطاقة',
  open_card: 'افتح البطاقة', customer_added: 'تمت إضافة الزبون', gender_f: 'أنثى', gender_m: 'ذكر',
  ev_join: 'انضم إلى البرنامج', ev_purchase: 'عملية شراء', ev_redeem: 'استبدل {r}', ev_adjust: 'تعديل نقاط', ev_tier: 'وصل إلى {r}',
  by_staff: 'بواسطة {s}', welcome_bonus_ev: 'هدية الانضمام',
  seg_new: 'جدد', seg_active: 'نشطون', seg_loyal: 'أوفياء', seg_vip: 'VIP', seg_at_risk: 'مهددون بالانقطاع', seg_inactive: 'منقطعون',
  seg_new_d: 'انضموا خلال ١٤ يوماً', seg_active_d: 'زاروا خلال ٣٠ يوماً', seg_loyal_d: '٥ زيارات أو أكثر وما زالوا يأتون',
  seg_vip_d: 'في أعلى مستوى', seg_at_risk_d: 'لا زيارة منذ ٣٠–٦٠ يوماً', seg_inactive_d: 'لا زيارة منذ أكثر من ٦٠ يوماً',
  crm_title: 'الشرائح', crm_auto: 'مجموعات تلقائية', crm_custom: 'شرائحك', crm_new: 'شريحة جديدة',
  crm_rules: 'الزبائن الذين…', crm_add_rule: 'أضف شرطاً', crm_matches: '{n} زبون مطابق',
  crm_returning: 'عائدون (زيارتان أو أكثر)', crm_presets: 'جاهزة',
  f_daysSinceVisit: 'أيام منذ آخر زيارة', f_joinedDaysAgo: 'أيام منذ الانضمام', f_spend: 'مجموع المشتريات', f_points: 'رصيد النقاط',
  f_lifetimePoints: 'مجموع النقاط المكتسبة', f_visits: 'الزيارات', f_redeemedCount: 'المكافآت المستبدلة', f_tierId: 'المستوى', f_birthdayMonth: 'شهر الميلاد',
  op_gt: 'أكثر من', op_gte: 'على الأقل', op_lt: 'أقل من', op_lte: 'على الأكثر', op_eq: 'يساوي', op_neq: 'لا يساوي',
  rw_title: 'المكافآت', rw_add: 'مكافأة جديدة', rw_name: 'اسم المكافأة', rw_name_ar: 'الاسم بالعربية', rw_desc: 'الوصف',
  rw_cost: 'الكلفة', rw_value: 'القيمة', rw_expires: 'تنتهي في', rw_min: 'أقل قيمة شراء', rw_limit: 'الحد الأقصى للاستخدام',
  rw_limit_hint: '0 يعني بلا حد', rw_on: 'متاحة للاستبدال', rw_empty: 'لا مكافآت بعد. أضف واحدة ليكون للأعضاء هدف.',
  rw_image: 'صورة', rw_saved: 'تم حفظ المكافأة', rw_redemptions: 'آخر الاستبدالات',
  pg_title: 'برنامج الولاء', pg_type: 'نوع البرنامج', pg_rule: 'قاعدة الكسب', pg_spend_each: 'لكل', pg_give: 'امنح',
  pg_welcome: 'هدية الانضمام', pg_welcome_hint: 'تُمنح مرة واحدة عند الانضمام.', pg_tiers: 'مستويات العضوية',
  pg_tier_min: 'ابتداءً من ({unit} مكتسبة)', pg_tier_benefits: 'المزايا', pg_add_tier: 'إضافة مستوى', pg_preview: 'مثال',
  pg_example: 'فاتورة بقيمة {amt} تكسب {n} {unit}.', pg_change_warn: 'تغيير نوع البرنامج يُبقي الأرصدة الحالية كما هي.',
  pg_goal: 'عدد الأختام على البطاقة',
  ds_title: 'تصميم البطاقة', ds_style: 'النمط', ds_layout: 'التخطيط', ds_colors: 'الألوان', ds_bg: 'لون البطاقة',
  ds_secondary: 'لون مميز', ds_text: 'لون النص', ds_primary: 'لون العلامة', ds_program_name: 'اسم البرنامج (إنكليزي)', ds_program_name_ar: 'اسم البرنامج',
  ds_icon: 'الأيقونة', ds_code: 'الرمز على البطاقة', ds_cover: 'صورة الغلاف', ds_logo: 'الشعار', ds_remove: 'إزالة',
  st_gradient: 'متدرّج', st_solid: 'سادة', st_split: 'لونان', st_minimal: 'فاتح',
  ly_classic: 'الرصيد أولاً', ly_centered: 'في المنتصف', ly_stamps: 'شبكة أختام',
  code_qr: 'رمز QR', code_barcode: 'باركود', ds_preview_as: 'معاينة باسم', ds_wallet_note: 'البطاقة مصممة بنفس بنية بطاقات Apple/Google Wallet لتُضاف إلى محفظة الموبايل لاحقاً.',
  cp_title: 'الحملات', cp_new: 'حملة جديدة', cp_name: 'اسم الحملة', cp_segment: 'أرسل إلى', cp_channel: 'القناة',
  cp_message: 'الرسالة', cp_vars: 'أدرج', cp_preview: 'معاينة لـ {name}', cp_prepare: 'جهّز قائمة المستلمين',
  cp_ready: 'جاهزة — {n} مستلم', cp_draft: 'مسودة', cp_recipients: '{n} شخص وافقوا على الاستلام',
  cp_note: 'الإرسال التلقائي عبر واتساب والرسائل والبريد يُربط هنا لاحقاً. حالياً افتح كل محادثة بضغطة أو صدّر القائمة.',
  cp_open_wa: 'افتح واتساب', cp_empty: 'لا حملات بعد. اختر شريحة واكتب رسالة قصيرة.',
  cp_templates: 'الرسائل التلقائية', ch_whatsapp: 'واتساب', ch_sms: 'رسالة نصية', ch_email: 'بريد', ch_push: 'إشعار',
  tp_welcome: 'الترحيب', tp_reward_ready: 'مكافأة متاحة', tp_tier_up: 'ترقية المستوى', tp_birthday: 'عيد الميلاد', tp_winback: 'استعادة الزبون',
  tp_hint: 'تُرسل تلقائياً بعد ربط مزوّد الرسائل.',
  an_title: 'التحليلات', an_range: 'آخر {n} يوماً', an_by_dow: 'أكثر الأيام ازدحاماً', an_by_tier: 'الأعضاء حسب المستوى', an_by_segment: 'الأعضاء حسب المجموعة',
  an_by_staff: 'المشتريات حسب الموظف', an_by_location: 'المبيعات حسب الفرع', an_return_rate: 'نسبة العودة', an_return_rate_d: 'أعضاء بزيارتين أو أكثر',
  an_redemption_rate: 'نسبة الاستبدال', an_redemption_rate_d: 'النقاط المستبدلة ÷ المكتسبة', an_avg_visits: 'زيارات لكل عضو',
  lc_title: 'الفروع', lc_add: 'إضافة فرع', lc_name: 'الاسم', lc_address: 'العنوان', lc_hint: 'كل عملية شراء تُسجَّل مع الفرع الذي تمت فيه.',
  sf_title: 'الفريق', sf_invite: 'دعوة شخص', sf_invite_hint: 'يسجّل بهذا البريد ويحصل على الصلاحية تلقائياً.',
  sf_pending: 'مدعو', sf_role: 'الصلاحية', sf_you: 'أنت', sf_remove: 'إزالة الصلاحية', sf_invited: 'تم حفظ الدعوة',
  se_title: 'الإعدادات', se_business: 'معلومات النشاط', se_currency: 'العملة', se_language: 'لغة صفحة الزبون',
  se_plan: 'الباقة', se_audit: 'سجل العمليات', se_danger: 'تجريبي', se_join_link: 'رابط الانضمام', se_card_url: 'صفحة الزبون',
  plan_free: 'مجانية', plan_starter: 'أساسية', plan_professional: 'احترافية', plan_enterprise: 'مؤسسات',
  qr_title: 'رمز الانضمام والملصق', qr_sub: 'يمسحه الزبون فينضم في أقل من دقيقة.', qr_poster: 'ملصق للطباعة',
  qr_poster_h: 'انضم إلى مكافآتنا', qr_poster_sub: 'امسح واكسب {unit} مع كل زيارة', qr_png: 'تنزيل QR (PNG)', qr_svg: 'تنزيل QR (SVG)',
  qr_where: 'ضعه على الطاولات والقوائم والفواتير والكاونتر والتغليف.', qr_print_poster: 'اطبع الملصق',
  join_title: 'انضم إلى مكافآت {biz}', join_sub: 'اكسب {unit} مع كل زيارة.', join_btn: 'انضم الآن', join_consent: 'أرسلوا لي العروض على واتساب',
  join_welcome: 'أهلاً بك في {program}!', join_exists: 'أنت عضو مسبقاً. بطاقتك محفوظة على الموبايل الذي انضممت منه — أو اطلب من الكاشير إرسالها لك.',
  join_privacy: 'رقمك يبقى عند {biz} فقط.', join_bonus: 'حصلت على {n} {unit} هدية الانضمام.',
  c_card: 'البطاقة', c_rewards: 'المكافآت', c_activity: 'الحركات', c_profile: 'حسابي', c_points: 'النقاط',
  c_show_staff: 'اعرض هذا على الكاشير', c_to_next: '{n} {unit} للوصول إلى {tier}', c_top_tier: 'أنت في أعلى مستوى',
  c_available: 'يمكنك الاستبدال', c_locked: 'قريباً', c_need_more: 'ينقصك {n} {unit}', c_redeem: 'استبدال',
  c_code_title: 'اعرض هذا الرمز على الكاشير', c_code_exp: 'صالح حتى {t}', c_code_done: 'استُخدم {d}',
  c_no_activity: 'ستظهر زياراتك هنا.', c_save_card: 'أضف الصفحة إلى الشاشة الرئيسية لتبقى بطاقتك قريبة.',
  c_wallet_soon: 'محفظة Apple وGoogle قريباً', c_member: 'العضو', c_tier_benefits: 'مزاياك',
  c_profile_saved: 'تم حفظ معلوماتك', c_install: 'أضف إلى الشاشة الرئيسية', c_card_missing: 'رابط البطاقة غير صالح. اطلب من الكاشير إرساله مجدداً.',
  c_open_codes: 'رموز مكافآتك', c_rewards_count: '{n} مكافآت جاهزة', c_stamps_left: 'باقي {n} للمكافأة',
  c_paused: 'هذا البرنامج متوقف حالياً.',
  ad_title: 'إدارة المنصة', ad_businesses: 'الأنشطة', ad_active: 'نشطة', ad_customers: 'الأعضاء (الكل)', ad_txns: 'المشتريات',
  ad_redeemed: 'الاستبدالات', ad_new: 'جديدة (٣٠ يوماً)', ad_suspend: 'إيقاف', ad_reactivate: 'إعادة تفعيل', ad_plan: 'الباقة',
  ad_health: 'النظام', ad_settings: 'إعدادات المنصة', ad_signups: 'السماح بتسجيل أنشطة جديدة', ad_announcement: 'إعلان لأصحاب الأنشطة',
  ad_privacy: 'أسماء الزبائن وأرقامهم لا تظهر هنا أبداً.', ad_last_active: 'آخر نشاط', ad_mode: 'الخادم', ad_not_admin: 'هذا الحساب ليس مدير منصة.',
  ad_suspended: 'موقوف', ad_usage: 'الاستخدام',
  ago_now: 'الآن', ago_m: 'منذ {n} د', ago_h: 'منذ {n} س', ago_d: 'منذ {n} أيام', yesterday: 'أمس', today: 'اليوم',
};

const DICTS = { en, ar };
const LANG_KEY = 'nuqta_lang';
export let lang = localStorage.getItem(LANG_KEY) || CONFIG.DEFAULT_LANG;
export const missing = new Set();

export function setLang(l, { persist = true } = {}) {
  lang = l === 'en' ? 'en' : 'ar';
  if (persist) localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}
export function t(key, vars) {
  let s = DICTS[lang][key] ?? en[key];
  if (s == null) { missing.add(key); s = key; }
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s;
}
export const appName = () => CONFIG.APP_NAME[lang] || CONFIG.APP_NAME.en;
export const keys = () => ({ en: Object.keys(en), ar: Object.keys(ar) });

// Western digits in both languages: cashiers type amounts with them, and receipts use them.
const locale = () => (lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB');
export const fmtNum = (n) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(Number(n) || 0);
export const fmtMoney = (n, cur = 'SYP') => {
  const sym = { SYP: lang === 'ar' ? 'ل.س' : 'SYP', USD: '$', CAD: 'CA$', EUR: '€', LBP: lang === 'ar' ? 'ل.ل' : 'LBP' }[cur] || cur;
  const v = fmtNum(n);
  return cur === 'USD' || cur === 'EUR' || cur === 'CAD' ? `${sym}${v}` : `${v} ${sym}`;
};
export const curLabel = (cur) => ({ SYP: lang === 'ar' ? 'ل.س' : 'SYP' }[cur] || cur);
export const fmtDate = (ms, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => (ms ? new Intl.DateTimeFormat(locale(), opts).format(new Date(ms)) : '—');
export const fmtTime = (ms) => new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
export function ago(ms) {
  if (!ms) return '—';
  const d = Date.now() - ms;
  if (d < 60000) return t('ago_now');
  if (d < 3600000) return t('ago_m', { n: Math.floor(d / 60000) });
  if (d < 86400000) return t('ago_h', { n: Math.floor(d / 3600000) });
  if (d < 2 * 86400000) return t('yesterday');
  if (d < 14 * 86400000) return t('ago_d', { n: Math.floor(d / 86400000) });
  return fmtDate(ms);
}
// Unit word for a program (e.g. "points", "stamps", or the currency for spend programs).
export const unitWord = (program, currency) => t(({ points: 'u_points', visits: 'u_visits', stamps: 'u_stamps', spend: 'u_spend' })[program?.type] || 'u_points', { cur: curLabel(currency) });
export const tierName = (tier) => (tier ? (lang === 'ar' && tier.nameAr ? tier.nameAr : tier.name) : '');
export const rewardName = (r) => (r ? (lang === 'ar' && r.nameAr ? r.nameAr : r.name) : '');
export const programName = (b) => (lang === 'ar' && b?.design?.programNameAr) || b?.design?.programName || b?.name || '';

setLang(lang, { persist: false });
