/**
 * Builds WhatsApp reply messages.
 * Language matched to detected_language from Whisper.
 * Equipment tags / numbers always in English.
 */

type Language = 'en' | 'hi' | 'gu' | 'ta' | 'ml';

export type ReplyType =
  | 'confirmed'
  | 'parked'
  | 'ask_resend'
  | 'ask_unit'
  | 'ask_activity'
  | 'unregistered'
  | 'no_active_workpack'
  | 'tag_not_found'
  // R4: M16 pipeline reply types
  | 'confirmation_prompt'
  | 'execution_success'
  | 'execution_failed'
  | 'permission_denied'
  | 'event_ambiguous'
  | 'entity_ambiguous'
  | 'identity_rejected'
  | 'no_active_event';

const REPLIES: Record<ReplyType, Record<Language, string>> = {
  confirmed: {
    en: '✅ Updated!\n{workpack} — {activity}\nProgress: {progress}%\nRecorded at {time}',
    hi: '✅ Update ho gaya!\n{workpack} — {activity}\nProgress: {progress}%\n{time} baje',
    gu: '✅ Update thai gayu!\n{workpack} — {activity}\nProgress: {progress}%\n{time}',
    ta: '✅ புதுப்பிக்கப்பட்டது!\n{workpack} — {activity}\nதகவல்: {progress}%\n{time}',
    ml: '✅ അപ്‌ഡേറ്റ് ചെയ്തു!\n{workpack} — {activity}\nപുരോഗതി: {progress}%\n{time}',
  },
  parked: {
    en: '⏳ Received. Your update is being reviewed by the planner.\n{workpack} — {activity}\nProgress: {progress}%',
    hi: '⏳ Mil gaya. Planner review kar raha hai.\n{workpack} — {activity}\nProgress: {progress}%',
    gu: '⏳ Malyu. Planner tapas kare chhe.\n{workpack} — {activity}\nProgress: {progress}%',
    ta: '⏳ கிடைத்தது. திட்டமிடுபவர் சரிபார்க்கிறார்.\n{workpack} — {activity}\nதகவல்: {progress}%',
    ml: '⏳ ലഭിച്ചു. പ്ലാനർ പരിശോധിക്കുന്നു.\n{workpack} — {activity}\nപുരോഗതി: {progress}%',
  },
  ask_resend: {
    en: '❓ Could not understand clearly. Please resend:\nUnit name, Equipment tag, Job description, Progress %\n\nExample: FCC, E-101A, bundle inspection, 75%',
    hi: '❓ Samajh nahi aaya. Dobara bhejein:\nUnit naam, Equipment tag, Kaam ka vivaran, Progress %\n\nUdaharan: FCC, E-101A, bundle jaanch, 75%',
    gu: '❓ Samajyu nahi. Pharthi moklo:\nUnit naam, Equipment tag, Kaam no vivaran, Progress %\n\nUdaharan: FCC, E-101A, bundle tapas, 75%',
    ta: '❓ புரியவில்லை. மீண்டும் அனுப்பவும்:\nஓட்டம் பெயர், உபகரண குறிச்சொல், வேலை விவரம், முன்னேற்றம் %\n\nஎடுத்துக்காட்டு: FCC, E-101A, bundle பரிசோதனை, 75%',
    ml: '❓ മനസ്സിലായില്ല. വീണ്ടും അയക്കുക:\nയൂണിറ്റ് പേര്, ഉപകരണ ടാഗ്, ജോലി വിവരണം, പുരോഗതി %\n\nഉദാഹരണം: FCC, E-101A, bundle പരിശോധന, 75%',
  },
  ask_unit: {
    en: '❓ Which unit is {tag} in?\n(Reply with unit name e.g. FCC, CDU, VDU)',
    hi: '❓ {tag} kis unit mein hai?\n(Unit naam likhein jaise FCC, CDU, VDU)',
    gu: '❓ {tag} kaya unit ma chhe?\n(Unit naam lakho jema FCC, CDU, VDU)',
    ta: '❓ {tag} எந்த யூனிட்டில் உள்ளது?\n(யூனிட் பெயர் கூறுங்கள் எ.கா FCC, CDU)',
    ml: '❓ {tag} ഏത് യൂണിറ്റിലാണ്?\n(യൂണിറ്റ് പേര് അറിയിക്കൂ, ഉദാ: FCC, CDU)',
  },
  ask_activity: {
    en: 'Found {count} matching activities. Reply with number:\n{list}',
    hi: '{count} kaam mile. Number se jawab dein:\n{list}',
    gu: '{count} activities malya. Number reply karo:\n{list}',
    ta: '{count} பணிகள் கண்டறியப்பட்டன. எண்ணில் பதில் அளிக்கவும்:\n{list}',
    ml: '{count} ജോലികൾ കണ്ടെത്തി. നമ്പർ ഉത്തരം നൽകുക:\n{list}',
  },
  unregistered: {
    en: '⛔ Your WhatsApp number is not registered in the system. Ask your supervisor to link your number to your account.',
    hi: '⛔ Aapka number register nahi hai. Supervisor se request karein ki aapka number account se link karein.',
    gu: '⛔ Tamaro number register nathi. Supervisor ne kaho ke tamaro number account sathe link kare.',
    ta: '⛔ உங்கள் எண் பதிவு செய்யப்படவில்லை. உங்கள் மேற்பார்வையாளரிடம் கேளுங்கள்.',
    ml: '⛔ നിങ്ങളുടെ നമ്പർ രജിസ്റ്റർ ചെയ്തിട്ടില്ല. സൂപ്പർവൈസറോട് ചോദിക്കൂ.',
  },
  no_active_workpack: {
    en: '⚠ No active workpack found for {tag}. Contact your planner.',
    hi: '⚠ {tag} ke liye koi active workpack nahi mila. Planner se baat karein.',
    gu: '⚠ {tag} mate active workpack nathi. Planner ne contact karo.',
    ta: '⚠ {tag} க்கு செயலில் உள்ள workpack இல்லை.',
    ml: '⚠ {tag} ന് സജീവ workpack ഇല്ല.',
  },
  tag_not_found: {
    en: '⚠ Equipment tag {tag} not found in register. Check the tag number and try again.',
    hi: '⚠ Equipment tag {tag} register mein nahi mila. Tag number check karke dobara bhejein.',
    gu: '⚠ Equipment tag {tag} register ma nathi. Tag number tapasine pharthi moklo.',
    ta: '⚠ உபகரண குறிச்சொல் {tag} கண்டறியப்படவில்லை.',
    ml: '⚠ ഉപകരണ ടാഗ് {tag} കണ്ടെത്തിയില്ല.',
  },
  // ── R4: M16 Pipeline Reply Types ──────────────────────────────────────────
  confirmation_prompt: {
    en: '⚠ {message}\n\nReply *YES* to confirm or *NO* to cancel.',
    hi: '⚠ {message}\n\n*YES* likhein confirm karne ke liye ya *NO* cancel karne ke liye.',
    gu: '⚠ {message}\n\nConfirm karva *YES* lakho ke cancel karva *NO* lakho.',
    ta: '⚠ {message}\n\nஉறுதிப்படுத்த *YES* அனுப்பவும் அல்லது ரத்து செய்ய *NO* அனுப்பவும்.',
    ml: '⚠ {message}\n\nസ്ഥിരീകരിക്കാൻ *YES* അയക്കൂ അല്ലെങ്കിൽ റദ്ദാക്കാൻ *NO* അയക്കൂ.',
  },
  execution_success: {
    en: '✅ {message}',
    hi: '✅ {message}',
    gu: '✅ {message}',
    ta: '✅ {message}',
    ml: '✅ {message}',
  },
  execution_failed: {
    en: '❌ Action failed: {message}',
    hi: '❌ Action fail hua: {message}',
    gu: '❌ Action nisfal: {message}',
    ta: '❌ செயல் தோல்வியடைந்தது: {message}',
    ml: '❌ പ്രവർത്തനം പരാജയപ്പെട്ടു: {message}',
  },
  permission_denied: {
    en: '🔒 {message}',
    hi: '🔒 {message}',
    gu: '🔒 {message}',
    ta: '🔒 {message}',
    ml: '🔒 {message}',
  },
  event_ambiguous: {
    en: '❓ Multiple turnarounds found. Which one?\n{list}\n\nReply with number.',
    hi: '❓ Kai turnaround mile. Kaun sa?\n{list}\n\nNumber se jawab dein.',
    gu: '❓ Kai turnaround malya. Kayo?\n{list}\n\nNumber reply karo.',
    ta: '❓ பல நிகழ்வுகள் கண்டறியப்பட்டன. எது?\n{list}\n\nஎண்ணில் பதில் அளிக்கவும்.',
    ml: '❓ ഒന്നിലധികം ഇവന്റുകൾ. ഏത്?\n{list}\n\nനമ്പർ ഉത്തരം നൽകുക.',
  },
  entity_ambiguous: {
    en: 'Found {count} matching items. Reply with number:\n{list}',
    hi: '{count} items mile. Number se jawab dein:\n{list}',
    gu: '{count} items malya. Number reply karo:\n{list}',
    ta: '{count} உருப்படிகள் கண்டறியப்பட்டன. எண்ணில் பதில் அளிக்கவும்:\n{list}',
    ml: '{count} ഇനങ്ങൾ കണ്ടെത്തി. നമ്പർ ഉത്തരം നൽകുക:\n{list}',
  },
  identity_rejected: {
    en: '⛔ Access denied: {reason}. Contact your supervisor.',
    hi: '⛔ Access denied: {reason}. Supervisor se baat karein.',
    gu: '⛔ Access denied: {reason}. Supervisor ne contact karo.',
    ta: '⛔ அணுகல் மறுக்கப்பட்டது: {reason}.',
    ml: '⛔ ആക്സസ് നിഷേധിച്ചു: {reason}.',
  },
  no_active_event: {
    en: '⚠ No active turnaround found. Contact your planner.',
    hi: '⚠ Koi active turnaround nahi mila. Planner se baat karein.',
    gu: '⚠ Active turnaround nathi. Planner ne contact karo.',
    ta: '⚠ செயலில் உள்ள நிகழ்வு இல்லை.',
    ml: '⚠ സജീവ ഇവന്റ് ഇല്ല.',
  },
};

export function buildReply(
  type: ReplyType,
  lang: string,
  vars: Record<string, string | number> = {}
): string {
  const safeLang = (['en', 'hi', 'gu', 'ta', 'ml'].includes(lang)
    ? lang
    : 'en') as Language;
  let template = REPLIES[type][safeLang] ?? REPLIES[type]['en'];
  for (const [k, v] of Object.entries(vars)) {
    template = template.replaceAll(`{${k}}`, String(v));
  }
  return template;
}
