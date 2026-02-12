/* 
  script.js
  - يحول كل fieldset إلى سلايد واحد.
  - دعم: أزرار prev/next، مفاتيح الأسهم، سحب باللمس (swipe).
  - عرض شريط التقدم وتحديثه.
  - التحقق النهائي قبل الإرسال، وسلوك إرسال خاص بالـlocalhost لتجنّب CORS.
  - يسجل كل محاولة إرسال في console (timestamp + الإجابات + endpoint).
  - يحتوي تعليقات بالعربية لشرح كل وظيفة.
*/

/* ======== مساعدة: الحصول على قيمة راديو ======== */
function getRadioValue(form, name) {
  const el = form.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

/* ======== جمع الإجابات ======== */
function collectAnswers(form) {
  return {
    gender: getRadioValue(form, 'gender'),
    q1: getRadioValue(form, 'q1'),
    q2: getRadioValue(form, 'q2'),
    q3: getRadioValue(form, 'q3'),
    q4: getRadioValue(form, 'q4'),
    q5: getRadioValue(form, 'q5'),
    q6: getRadioValue(form, 'q6'),
    consent: !!form.querySelector('input[name="consent"]:checked')
  };
}

/* ======== تحقق شامل قبل الإرسال ======== */
function validateAnswers(answers) {
  if (!answers.gender) return {ok:false, msg:'يرجى اختيار الجنس.'};
  if (!answers.q1) return {ok:false, msg:'يرجى الإجابة على السؤال الأول.'};
  if (!answers.q2) return {ok:false, msg:'يرجى الإجابة على السؤال الثاني.'};
  if (!answers.q3) return {ok:false, msg:'يرجى الإجابة على السؤال الثالث.'};
  if (!answers.q4) return {ok:false, msg:'يرجى تقييم مستوى الثقة (1-5).'};
  if (!answers.q5) return {ok:false, msg:'يرجى الإجابة على السؤال الخامس.'};
  if (!answers.q6) return {ok:false, msg:'يرجى الإجابة على السؤال السادس.'};
  if (!answers.consent) return {ok:false, msg:'يجب الموافقة على تسجيل الردود قبل الإرسال.'};
  return {ok:true};
}

/* ======== عناصر DOM الأساسية ======== */
const form = document.getElementById('pollForm');
const fieldsets = Array.from(form.querySelectorAll('fieldset'));
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const stepCounter = document.getElementById('stepCounter');
const progressBar = document.getElementById('progressBar');
const messageBox = document.getElementById('formMessage');

let currentIndex = 0;

/* ======== تهيئة العرض الأولي للسلايدات ======== */
function initSlides() {
  fieldsets.forEach((fs, i) => {
    fs.classList.remove('active','left');
    if (i === 0) fs.classList.add('active');
    // أضف حدث لاختيار الخيار: لتلوين البطاقة عند الاختيار (UX)
    const options = Array.from(fs.querySelectorAll('.poll-option'));
    options.forEach(opt => {
      const input = opt.querySelector('input');
      if (!input) return;
      // عند النقر على الـlabel: نضيف فئة selected ونزيلها من الأخريات
      opt.addEventListener('click', (e) => {
        // تفعيل ripple
        triggerRipple(opt);
        if (input.type === 'radio') {
          // إزالة المحدد من أخواته داخل نفس المجموعة
          const group = fs.querySelectorAll('.poll-option');
          group.forEach(g => g.classList.remove('selected'));
          opt.classList.add('selected');
          // نحدد الـinput
          input.checked = true;
        } else if (input.type === 'checkbox') {
          input.checked = !input.checked;
          opt.classList.toggle('selected', input.checked);
        }
      });
    });

    // دعم عناصر السكيل (scale-item) — ربما input مخفي داخل label
    const scaleItems = Array.from(fs.querySelectorAll('.scale-item'));
    scaleItems.forEach(si => {
      const input = si.querySelector('input');
      if (!input) return;
      si.addEventListener('click', () => {
        // كل عناصر السكيل بنفس الـfieldset
        scaleItems.forEach(s => s.classList.remove('selected'));
        si.classList.add('selected');
        input.checked = true;
      });
    });
  });

  updateNav();
}

/* ======== تحديث مؤشر التقدّم والعداد ======== */
function updateNav() {
  const total = fieldsets.length;
  stepCounter.textContent = `${currentIndex + 1} / ${total}`;
  const percent = Math.round(((currentIndex) / (total - 1)) * 100);
  progressBar.style.width = `${percent}%`;

  // زر السابق متاح الا في البداية
  prevBtn.disabled = currentIndex === 0;
  // زر التالي يظهر "إرسال" في النهاية
  if (currentIndex === fieldsets.length - 1) {
    nextBtn.innerHTML = 'إرسال <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>';
    nextBtn.classList.remove('btn-next');
    nextBtn.classList.add('submit-final');
  } else {
    nextBtn.innerHTML = 'التالي <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>';
    nextBtn.classList.add('btn-next');
    nextBtn.classList.remove('submit-final');
  }
}

/* ======== عرض سلايد معين ======== */
function showSlide(index, direction = 'forward') {
  if (index < 0 || index >= fieldsets.length) return;
  // تحديد الفئات للكلاسات animation
  fieldsets.forEach((fs, i) => {
    fs.classList.remove('active','left');
    if (i < index) fs.classList.add('left'); // تلك التي قبل الحالي تصبح left
    if (i === index) fs.classList.add('active');
  });
  currentIndex = index;
  updateNav();
  // مسح رسالة إذا كانت ظاهرة
  if (messageBox) { messageBox.textContent = ''; messageBox.classList.remove('error'); }
}

/* ======== أحداث الأزرار ======== */
prevBtn.addEventListener('click', () => {
  showSlide(currentIndex - 1, 'back');
});
nextBtn.addEventListener('click', () => {
  if (currentIndex === fieldsets.length - 1) {
    // آخر سلايد ⇒ محاولة إرسال
    submitForm();
    return;
  }
  // تحقق محلي للخطوة الحالية قبل الانتقال
  const stepFs = fieldsets[currentIndex];
  const validStep = validateStep(stepFs);
  if (!validStep.ok) {
    showMessage(validStep.msg, true);
    return;
  }
  showSlide(currentIndex + 1, 'forward');
});

/* ======== تحقق مختصر لخطوة معينة ======== */
function validateStep(fieldset) {
  const radios = Array.from(fieldset.querySelectorAll('input[type="radio"]'));
  const checkbox = fieldset.querySelector('input[type="checkbox"]');
  if (radios.length) {
    const any = radios.some(r => r.checked);
    return any ? {ok:true} : {ok:false, msg:'يرجى اختيار خيار للاستمرار.'};
  }
  if (checkbox) {
    return checkbox.checked ? {ok:true} : {ok:false, msg:'يجب الموافقة للمتابعة.'};
  }
  return {ok:true};
}

/* ======== عرض رسالة الحالة ======== */
function showMessage(msg, isError=false) {
  if (!messageBox) return;
  messageBox.textContent = msg;
  messageBox.classList.toggle('error', !!isError);
}

/* ======== إرسال النموذج (سلوك XAMPP/localhost vs production) ======== */
function isLocalhost() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

async function sendWithFetch(formEl, answers, nextUrl) {
  const formData = new FormData(formEl);
  console.info('Attempting to send poll (fetch):', {timestamp: new Date().toISOString(), endpoint: formEl.action, answers});
  try {
    const resp = await fetch(formEl.action, {method: 'POST', body: formData, headers:{'Accept':'text/plain'}});
    console.info('Formspree response status:', resp.status);
    if (resp.ok || resp.status === 200 || resp.status === 202) {
      if (nextUrl) window.location.href = nextUrl;
      else showMessage('تم إرسال إجابتك بنجاح. شكراً.', false);
    } else {
      const txt = await resp.text().catch(()=>null);
      showMessage('حدث خطأ أثناء الإرسال — حاول مرة أخرى.', true);
      console.error('Formspree returned error:', resp.status, txt);
    }
  } catch (err) {
    showMessage('تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.', true);
    console.error('Network error while sending form (fetch):', err);
  }
}

function submitForm() {
  const answers = collectAnswers(form);
  const valid = validateAnswers(answers);
  if (!valid.ok) {
    showMessage(valid.msg, true);
    // إذا كانت المشكلة في الموافقة، نفهم المستخدم ويذهب إلى آخر سلايد
    if (valid.msg.includes('الموافقة')) showSlide(fieldsets.length - 1);
    return;
  }
  // تسجيل المحاولة
  console.info('Poll submission attempt:', {timestamp: new Date().toISOString(), endpoint: form.action, answers});
  showMessage('جارٍ إرسال إجابتك...', false);

  const nextInput = form.querySelector('input[name="_next"]');
  const nextUrl = nextInput ? nextInput.value : null;

  if (isLocalhost()) {
    // على localhost: نترك المتصفح يرسل النموذج طبيعياً (لتجنّب CORS)
    form.submit();
    return;
  }
  // في بيئة حية: نجرب fetch
  sendWithFetch(form, answers, nextUrl);
}

/* ======== دعم لوحة المفاتيح للتنقل (أسهم اليمين واليسار) ======== */
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') {
    // محاولة الانتقال للأمام
    if (currentIndex < fieldsets.length - 1) nextBtn.click();
  } else if (e.key === 'ArrowLeft') {
    if (currentIndex > 0) prevBtn.click();
  }
});

/* ======== Swipe support للهواتف ======== */
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;

form.addEventListener('touchstart', (e) => {
  if (e.touches && e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchMoved = false;
  }
}, {passive:true});

form.addEventListener('touchmove', (e) => {
  touchMoved = true;
}, {passive:true});

form.addEventListener('touchend', (e) => {
  if (!touchMoved) return;
  const touchEndX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : 0;
  const dx = touchEndX - touchStartX;
  if (Math.abs(dx) > 40) {
    if (dx < 0 && currentIndex < fieldsets.length -1) nextBtn.click(); // swipe left -> next
    if (dx > 0 && currentIndex > 0) prevBtn.click(); // swipe right -> prev
  }
});

/* ======== Ripple effect لزر/بطاقة (بسيطة) ======== */
function triggerRipple(el) {
  el.classList.add('ripple','activated');
  setTimeout(()=> el.classList.remove('activated'), 420);
}

/* ======== Theme toggle: حفظ الاختيار في localStorage ======== */
const themeToggle = document.getElementById('themeToggle');
function setupTheme() {
  const saved = localStorage.getItem('site-theme');
  if (saved === 'dark') document.documentElement.classList.add('dark');
  updateThemeIcon();
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('site-theme', isDark ? 'dark' : 'light');
      updateThemeIcon();
    });
  }
}
function updateThemeIcon() {
  if (!themeToggle) return;
  const isDark = document.documentElement.classList.contains('dark');
  themeToggle.innerHTML = isDark
    ? '<svg class="icon sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.76 4.84l-1.8-1.79L3.17 4.84 4.96 6.63 6.76 4.84zM1 13h3v-2H1v2zm10 8h2v-3h-2v3zM17.24 4.84l1.79-1.79 1.79 1.79-1.79 1.79-1.79-1.79zM20 11v2h3v-2h-3zM6.76 19.16l-1.8 1.79-1.79-1.79 1.79-1.79 1.8 1.79zM17.24 19.16l1.79 1.79 1.79-1.79-1.79-1.79-1.79 1.79zM12 6a6 6 0 100 12A6 6 0 0012 6z"/></svg>'
    : '<svg class="icon moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
}

/* ======== بدء التشغيل ======== */
document.addEventListener('DOMContentLoaded', () => {
  initSlides();
  setupTheme();
  // تأكد من تحديث الprogress عند التحميل (في حال قام المستخدم بتسجيل قيمة مسبقاً)
  showSlide(0);
});
