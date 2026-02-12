/* script.js (محدّث)
   - الآن يستخدم form.submit() لإرسال النموذج (يتخطّى مشاكل CORS مع Formspree).
   - يدعم السلايدات (كل fieldset سلايد)، Prev/Next، Swipe على الموبايل، مفاتيح الأسهم.
   - يعرض شريط تقدّم ويحدّث العداد.
   - يحفظ تفضيل الثيم في localStorage.
   - يسجّل كل محاولة إرسال في console مع الطوابع الزمنية والإجابات (للتحقق فقط).
   - جميع التعليقات باللغة العربية لسهولة الفهم.
*/

/* =====================
   دوال مساعدة صغيرة
   ===================== */
function getRadioValue(form, name) {
  const el = form.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

function collectAnswers(form) {
  // نجمع القيم المسموح بها فقط (لا PII)
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

function validateAnswers(answers) {
  // تحقق شامل قبل الإرسال النهائي
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

/* تحقق مختصر لخطوة واحدة قبل الانتقال */
function validateStep(fieldset) {
  const radios = Array.from(fieldset.querySelectorAll('input[type="radio"]'));
  const checkbox = fieldset.querySelector('input[type="checkbox"]');
  if (radios.length) {
    const any = radios.some(r => r.checked);
    return any ? {ok:true} : {ok:false, msg:'يرجى اختيار خيار للاستمرار.'};
  }
  if (checkbox) return checkbox.checked ? {ok:true} : {ok:false, msg:'يجب الموافقة للمتابعة.'};
  return {ok:true};
}

/* =====================
   عناصر DOM الأساسية
   ===================== */
const form = document.getElementById('pollForm');
const fieldsets = Array.from(form.querySelectorAll('fieldset'));
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const stepCounter = document.getElementById('stepCounter');
const progressBar = document.getElementById('progressBar');
const messageBox = document.getElementById('formMessage');

let currentIndex = 0;

/* =====================
   تهيئة السلايدات والخيارات
   ===================== */
function initSlides() {
  // أضف أحداث اختيار لكل خيار لتفعيل النمط البصري selected
  fieldsets.forEach((fs, i) => {
    // Ensure attributes
    fs.dataset.stepIndex = i;
    // التعامل مع خيارات poll-option
    const opts = Array.from(fs.querySelectorAll('.poll-option'));
    opts.forEach(opt => {
      const input = opt.querySelector('input');
      if (!input) return;
      // عند النقر على العنصر نحدّد القيمة ونحدث الواجهة
      opt.addEventListener('click', (e) => {
        e.preventDefault(); // منع سلوك افتراضي إن وُجد
        // ripple لمسة UX خفيفة
        triggerRipple(opt);
        if (input.type === 'radio') {
          // إزالة التحديد عن باقي الخيارات ضمن نفس الـfieldset
          opts.forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          input.checked = true;
        } else if (input.type === 'checkbox') {
          input.checked = !input.checked;
          opt.classList.toggle('selected', input.checked);
        } else {
          // لأي نوع آخر
          input.checked = true;
        }
      });
    });

    // scale items (اذا وُجدت)
    const scales = Array.from(fs.querySelectorAll('.scale-item'));
    if (scales.length) {
      scales.forEach(si => {
        const input = si.querySelector('input');
        si.addEventListener('click', () => {
          scales.forEach(s => s.classList.remove('selected'));
          si.classList.add('selected');
          if (input) input.checked = true;
        });
      });
    }

    // إخفاء كل السلايدات مبدئياً وإظهار الأولى لاحقاً عبر showSlide
    fs.classList.remove('active','left');
  });

  // عرض السلايد الأول
  showSlide(0);
}

/* =====================
   عرض سلايد محدد وتحديث الواجهة
   ===================== */
function showSlide(index) {
  if (index < 0) index = 0;
  if (index >= fieldsets.length) index = fieldsets.length - 1;

  fieldsets.forEach((fs, i) => {
    fs.classList.remove('active','left');
    if (i < index) fs.classList.add('left'); // سلايدات قبل الحالية تتحول لليسار
    if (i === index) fs.classList.add('active');
  });

  currentIndex = index;
  updateNav();
  // محو أي رسالة خطأ عند التنقل
  if (messageBox) { messageBox.textContent = ''; messageBox.classList.remove('error'); }
}

/* =====================
   تحديث شريط التقدّم وحالة الأزرار
   ===================== */
function updateNav() {
  const total = fieldsets.length;
  if (stepCounter) stepCounter.textContent = `${currentIndex + 1} / ${total}`;
  const percent = Math.round(((currentIndex) / (total - 1)) * 100);
  if (progressBar) progressBar.style.width = `${percent}%`;

  if (prevBtn) prevBtn.disabled = currentIndex === 0;

  // في آخر سلايد غيّر نص الزر التالي إلى "إرسال"
  if (nextBtn) {
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
}

/* =====================
   أحداث الأزرار
   ===================== */
if (prevBtn) {
  prevBtn.addEventListener('click', () => {
    showSlide(currentIndex - 1);
  });
}
if (nextBtn) {
  nextBtn.addEventListener('click', () => {
    // إذا كنا في آخر سلايد => إرسال
    if (currentIndex === fieldsets.length - 1) {
      submitForm();
      return;
    }
    // تحقق للخطوة الحالية قبل الانتقال
    const currentFs = fieldsets[currentIndex];
    const ok = validateStep(currentFs);
    if (!ok.ok) {
      showMessage(ok.msg, true);
      return;
    }
    showSlide(currentIndex + 1);
  });
}

/* =====================
   دالة عرض رسالة للمستخدم
   ===================== */
function showMessage(msg, isError=false) {
  if (!messageBox) {
    alert(msg);
    return;
  }
  messageBox.textContent = msg;
  messageBox.classList.toggle('error', !!isError);
}

/* =====================
   دالة إرسال النموذج: الآن تستخدم form.submit()
   ===================== */
function submitForm() {
  // جمع الإجابات والتحقق الشامل قبل الإرسال
  const answers = collectAnswers(form);
  const valid = validateAnswers(answers);
  if (!valid.ok) {
    showMessage(valid.msg, true);
    // لو المشكلة الموافقة اجعل المستخدم يتجه لآخر سلايد
    if (valid.msg && valid.msg.includes('الموافقة')) showSlide(fieldsets.length - 1);
    return;
  }

  // سجل المحاولة في الـconsole للتدقيق (لا تحفظ بيانات محلياً)
  console.info('Poll submission attempt:', {
    timestamp: new Date().toISOString(),
    endpoint: form.action,
    answers
  });

  // عرض رسالة وإيقاف الأزرار للحيلولة دون الإرسال المتكرر
  showMessage('جارٍ إرسال إجابتك...', false);
  disableNavButtons();

  // تأكد أن _next يحتوي رابط صفحة الشكر (يمكن أن يكون مسار كامل أو نسبي)
  // ثم نستخدم submit() العادي للمتصفح ليقوم بـ POST ويتعامل مع redirect و _next
  try {
    form.submit(); // إرسال تقليدي - هذا يتفادى CORS لأنّه ليس AJAX
  } catch (err) {
    // لو حصل خطأ غير متوقع
    console.error('Error while calling form.submit():', err);
    showMessage('حدث خطأ أثناء محاولة الإرسال. حاول إعادة تحميل الصفحة ثم أرسل مرة أخرى.', true);
    enableNavButtons();
  }
}

function disableNavButtons() {
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
}
function enableNavButtons() {
  if (prevBtn) prevBtn.disabled = false;
  if (nextBtn) nextBtn.disabled = false;
}

/* =====================
   دعم مفاتيح الأسهم (تجربة سطح المكتب)
   ===================== */
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') {
    if (currentIndex < fieldsets.length - 1) nextBtn.click();
  } else if (e.key === 'ArrowLeft') {
    if (currentIndex > 0) prevBtn.click();
  }
});

/* =====================
   Swipe: دعم السحب باللمس للهواتف
   ===================== */
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
  // حد الطرد (threshold)
  if (Math.abs(dx) > 40) {
    if (dx < 0 && currentIndex < fieldsets.length -1) nextBtn.click(); // swipe left -> next
    if (dx > 0 && currentIndex > 0) prevBtn.click(); // swipe right -> prev
  }
});

/* =====================
   Ripple effect بسيط للـUX
   ===================== */
function triggerRipple(el) {
  el.classList.add('ripple','activated');
  setTimeout(()=> el.classList.remove('activated'), 420);
}

/* =====================
   Theme toggle (Light / Dark) مع حفظ في localStorage
   ===================== */
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
  // أيقونة بسيطة (SVG text)
  themeToggle.innerHTML = isDark
    ? '<svg class="icon sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.76 4.84l-1.8-1.79L3.17 4.84 4.96 6.63 6.76 4.84zM1 13h3v-2H1v2zm10 8h2v-3h-2v3zM17.24 4.84l1.79-1.79 1.79 1.79-1.79 1.79-1.79-1.79zM20 11v2h3v-2h-3zM6.76 19.16l-1.8 1.79-1.79-1.79 1.79-1.79 1.8 1.79zM17.24 19.16l1.79 1.79 1.79-1.79-1.79-1.79-1.79 1.79zM12 6a6 6 0 100 12A6 6 0 0012 6z"/></svg>'
    : '<svg class="icon moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
}

/* =====================
   منع الإرسال الافتراضي مباشرةً بالضغط Enter أو submit HTML
   - نلتقط حدث submit ونستبدله بمناداة submitForm()
   ===================== */
form.addEventListener('submit', function(e) {
  // نمنع السلوك الافتراضي وندير الإرسال عبر submitForm (والذي سيستدعي form.submit())
  e.preventDefault();
  submitForm();
});

/* =====================
   بدء التشغيل بعد تحميل DOM
   ===================== */
document.addEventListener('DOMContentLoaded', () => {
  initSlides();
  setupTheme();
  // تحديث العرض (في حال تم الاستعادة من حالة سابقة)
  showSlide(0);
});
