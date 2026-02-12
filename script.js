/* 
  تعليق بالعربية: سكربت مُحدّث
  - يجعل كل <fieldset> خطوة (step) ويعرض واحدة في كل مرة.
  - يضيف أزرار Next / Prev داخل كل خطوة تلقائياً.
  - التحقق كما في السابق (لا جمع PII).
  - سلوك الإرسال: عند التشغيل على localhost نسمح بالإرسال التقليدي (لتجنُّب CORS),
    أما في بيئة production نستخدم fetch.
  - يدعم زر تبديل الوضع الليلي ويحتفظ بالاختيار في localStorage.
*/

/* دوال مساعدة أساسية */
function getRadioValue(form, name) {
  const el = form.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

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

/* تحقق إجابات محدد (يستخدم للتحقق الكامل أو خطوة بخطوة) */
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

/* تحقق محلي مختصر لخطوة معينة: يتحقق إذا كان أي input داخل الحقل محددًا */
function validateStep(fieldset) {
  // نجد كل المدخلات داخل fieldset المعني
  const radios = Array.from(fieldset.querySelectorAll('input[type="radio"]'));
  const checkbox = fieldset.querySelector('input[type="checkbox"]');

  // إذا كانت الخطوة تحتوي راديوز — تأكد أن أحدهم مختار
  if (radios.length) {
    const any = radios.some(r => r.checked);
    return any ? {ok:true} : {ok:false, msg:'يرجى اختيار خيار للاستمرار.'};
  }

  // إذا كانت خطوة الموافقة checkbox
  if (checkbox) {
    return checkbox.checked ? {ok:true} : {ok:false, msg:'يجب الموافقة على الشروط للمتابعة.'};
  }

  // افتراضياً: تسمح بالانتقال
  return {ok:true};
}

/* عرض رسالة للمستخدم داخل الفورم */
function showMessage(formEl, message, isError) {
  const msgEl = formEl.querySelector('.form-message');
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.classList.toggle('error', !!isError);
  } else {
    alert(message);
  }
}

/* تعطيل زر الإرسال */
function disableSubmit(formEl) {
  const btn = formEl.querySelector('button[type="submit"], .submit-final');
  if (btn) btn.disabled = true;
}

/* هل نحن على localhost؟ */
function isLocalhost() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

/* إرسال بواسطة fetch (production) */
async function submitWithFetch(formEl, answers, nextUrl) {
  const formData = new FormData(formEl);

  console.info('Attempting to send poll (fetch):', {
    timestamp: new Date().toISOString(),
    endpoint: formEl.action,
    answers
  });

  try {
    const resp = await fetch(formEl.action, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'text/plain' }
    });

    console.info('Formspree response status:', resp.status);

    if (resp.ok || resp.status === 200 || resp.status === 202) {
      if (nextUrl) {
        window.location.href = nextUrl;
      } else {
        showMessage(formEl, 'تم إرسال إجابتك بنجاح. شكراً لمشاركتك.', false);
        disableSubmit(formEl);
      }
    } else {
      const txt = await resp.text().catch(()=>null);
      showMessage(formEl, 'حدث خطأ أثناء إرسال الإجابة — حاول مرة أخرى.', true);
      console.error('Formspree returned error:', resp.status, txt);
    }
  } catch (err) {
    showMessage(formEl, 'تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.', true);
    console.error('Network error while sending form (fetch):', err);
  }
}

/* إضافة أزرار التنقّل لكل خطوة (Next/Prev/Submit) */
function enhanceFormWithSteps(formEl) {
  const fieldsets = Array.from(formEl.querySelectorAll('fieldset'));
  if (!fieldsets.length) return;

  // نجعل كل fieldset خطوة ونضيف أيقونة صغيرة تلقائياً (يمكن تعديل النص داخل legend)
  fieldsets.forEach((fs, idx) => {
    fs.classList.add('step');
    // وسم ارتباط رقمي اختياري
    fs.dataset.stepIndex = idx;

    // إضافة أيقونة صغيرة قبل النص في legend (لو موجود)
    const legend = fs.querySelector('legend');
    if (legend) {
      // إنشاء عنصر أيقونة فقط لو ماكانش موجود
      if (!legend.querySelector('.question-icon')) {
        const ico = document.createElement('span');
        ico.className = 'question-icon';
        // تعبئة برقم السؤال أو رمز — تستطيع استبداله بـ SVG أو أيقونة Font Awesome
        ico.innerHTML = `${idx+1}`;
        legend.prepend(ico);
      }
    }

    // إنشاء منطقة أزرار
    const actions = document.createElement('div');
    actions.className = 'step-actions';

    // زر Prev (موجود إلا في الخطوة الأولى)
    if (idx > 0) {
      const prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'btn btn-prev';
      prev.innerHTML = '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> السابق';
      prev.addEventListener('click', () => showStep(formEl, idx-1));
      actions.appendChild(prev);
    } else {
      // عنصر فارغ للحفاظ على المسافات
      const spacer = document.createElement('div');
      actions.appendChild(spacer);
    }

    // زر Next أو زر إرسال نهائي
    if (idx < fieldsets.length - 1) {
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'btn btn-next';
      next.innerHTML = 'التالي <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
      next.addEventListener('click', () => {
        const valid = validateStep(fs);
        if (!valid.ok) {
          showMessage(formEl, valid.msg, true);
          return;
        }
        showStep(formEl, idx+1);
      });
      actions.appendChild(next);
    } else {
      // خطوة نهائية: زر إرسال
      const submitBtn = document.createElement('button');
      submitBtn.type = 'submit';
      submitBtn.className = 'submit-final';
      submitBtn.innerHTML = 'إرسال <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>';
      actions.appendChild(submitBtn);
    }

    // أضف actions أسفل الـfieldset
    fs.appendChild(actions);
  });

  // عرض الخطوة الأولى افتراضياً
  showStep(formEl, 0);
}

/* عرض خطوة معينة وإخفاء الباقي */
function showStep(formEl, index) {
  const steps = Array.from(formEl.querySelectorAll('fieldset.step'));
  steps.forEach((s, i) => {
    if (i === index) {
      s.classList.add('active');
      // نمسك أول عنصر قابل للتركيز داخل الخطوة
      const focusable = s.querySelector('input, button, select, textarea');
      if (focusable) focusable.focus({preventScroll:true});
    } else {
      s.classList.remove('active');
    }
  });

  // مسح أي رسالة خطأ عند التنقل
  const msg = formEl.querySelector('.form-message');
  if (msg) { msg.textContent = ''; msg.classList.remove('error'); }
}

/* إدارة الثيم (Light / Dark) */
function setupThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  // تحميل حالة المستخدم من localStorage
  const saved = localStorage.getItem('site-theme');
  if (saved === 'dark') document.documentElement.classList.add('dark');

  // تحديث أيقونة الزر حسب الوضع
  function refreshToggleIcon(){
    const isDark = document.documentElement.classList.contains('dark');
    // استخدام Font Awesome icons لو متاحة، أو نص بديل
    if (toggle.querySelector('i')) {
      toggle.querySelector('i').className = isDark ? 'fa-solid fa-sun' : 'fa-regular fa-moon';
    } else {
      toggle.textContent = isDark ? 'نهاري' : 'ليلي';
    }
  }
  refreshToggleIcon();

  toggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('site-theme', isDark ? 'dark' : 'light');
    refreshToggleIcon();
  });
}

/* ربط النماذج عند التحميل */
document.addEventListener('DOMContentLoaded', function() {
  // إعداد الثيم
  setupThemeToggle();

  const forms = [
    {id: 'pollForm', defaultNext: 'thankyou_ar.html'},
    {id: 'pollFormEn', defaultNext: 'thankyou_en.html'}
  ];

  forms.forEach(cfg => {
    const formEl = document.getElementById(cfg.id);
    if (!formEl) return;

    // اجعل الـfieldsets خطوات
    enhanceFormWithSteps(formEl);

    // اقرأ قيمة _next من الفورم إن وُجدت
    const nextInput = formEl.querySelector('input[name="_next"]');
    const nextUrl = nextInput ? nextInput.value : cfg.defaultNext;

    // حدث submit: نتحقق مرة أخيرة ثم نقرر طريقة الإرسال (localhost vs production)
    formEl.addEventListener('submit', function(e) {
      // جمع الإجابات والتحقق الشامل
      const answers = collectAnswers(formEl);
      const valid = validateAnswers(answers);
      if (!valid.ok) {
        e.preventDefault();
        showMessage(formEl, valid.msg, true);
        return;
      }

      // سجل المحاولة في الـconsole
      console.info('Poll submission attempt:', {
        timestamp: new Date().toISOString(),
        endpoint: formEl.action,
        answers
      });

      // سلوك الإرسال: على localhost نسمح بالإرسال التقليدي (لتجنب CORS)
      if (isLocalhost()) {
        // إظهار رسالة سريعة للمستخدم ثم السماح بالإرسال العادي
        showMessage(formEl, 'جارٍ إرسال إجابتك...', false);
        // نعطي متصفح قليل من الوقت ثم نترك الإرسال يتم (لا نمنع الحدث)
        // ملاحظة: لا ننفذ e.preventDefault()
        return;
      }

      // في بيئة production: نستخدم fetch لمعالجة الرد دون إعادة تحميل
      e.preventDefault();
      showMessage(formEl, 'جارٍ إرسال إجابتك...', false);
      submitWithFetch(formEl, answers, nextUrl);
    });
  });
});
