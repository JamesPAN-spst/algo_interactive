(function () {
    /* ===== THEME ===== */
    const body = document.body;
    const toggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme');
    body.dataset.theme = (savedTheme === 'night' || savedTheme === 'day') ? savedTheme : 'day';
    if (toggle) {
        toggle.textContent = body.dataset.theme === 'night' ? '切换到白天模式 ☀️' : '切换到夜晚模式 🌙';
        toggle.addEventListener('click', function () {
            const next = body.dataset.theme === 'night' ? 'day' : 'night';
            body.dataset.theme = next;
            localStorage.setItem('theme', next);
            toggle.textContent = next === 'night' ? '切换到白天模式 ☀️' : '切换到夜晚模式 🌙';
        });
    }

    /* ===== SEARCH (index page) ===== */
    const searchInput = document.getElementById('search');
    const moduleCards = Array.from(document.querySelectorAll('[data-module-card]'));
    if (searchInput && moduleCards.length > 0) {
        searchInput.addEventListener('input', function () {
            const kw = searchInput.value.trim().toLowerCase();
            moduleCards.forEach(c => { c.style.display = c.textContent.toLowerCase().includes(kw) ? '' : 'none'; });
        });
    }

    /* ===== QUIZ ENGINE ===== */
    Array.from(document.querySelectorAll('[data-quiz]')).forEach(function (quiz) {
        const key          = quiz.dataset.module || 'default';
        const statEl       = quiz.querySelector('[data-accuracy]');
        const diffStatEl   = quiz.querySelector('[data-diff-accuracy]');
        const wrongListEl  = quiz.querySelector('[data-wrong-list]');
        const jumpInput    = quiz.querySelector('[data-jump-input]');
        const jumpBtn      = quiz.querySelector('[data-jump-btn]');
        const resetAllBtn  = quiz.querySelector('[data-reset-all]');

        let state = loadState(key);

        restoreAnswers(quiz, state.answers);
        updateView();              // render stats + restore explanation boxes

        /* ----- Radio change: record answer + show explanation ----- */
        quiz.addEventListener('change', function (e) {
            const t = e.target;
            if (!t || !t.name || !t.matches('input[type="radio"]')) return;
            state.answers[t.name] = t.value;
            persistState();
            updateView();
            const qEl = quiz.querySelector(`[data-question-id="${t.name}"]`);
            if (qEl) showExplanation(qEl, t.value);
        });

        /* ----- Click: reset single / jump ----- */
        quiz.addEventListener('click', function (e) {
            const t = e.target;
            if (!(t instanceof HTMLElement)) return;
            if (t.matches('[data-reset-question]')) {
                const qid = t.dataset.resetQuestion;
                if (!qid) return;
                delete state.answers[qid];
                quiz.querySelectorAll(`input[name="${qid}"]`).forEach(i => i.checked = false);
                const qEl = quiz.querySelector(`[data-question-id="${qid}"]`);
                if (qEl) hideExplanation(qEl);
                persistState();
                updateView();
            }
        });

        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', function () {
                state.answers = {};
                quiz.querySelectorAll('input[type="radio"]').forEach(i => i.checked = false);
                quiz.querySelectorAll('[data-explanation-box]').forEach(b => hideBox(b));
                persistState();
                updateView();
            });
        }

        if (jumpBtn && jumpInput) {
            jumpBtn.addEventListener('click', function () {
                const qid = jumpInput.value.trim();
                const target = quiz.querySelector(`[data-question-id="${qid}"]`);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    target.classList.add('highlight');
                    setTimeout(() => target.classList.remove('highlight'), 1400);
                }
            });
        }

        /* ----- Explanation display ----- */
        function showExplanation(qEl, chosen) {
            const answer      = qEl.dataset.answer || '';
            const explanation = qEl.dataset.explanation || '';
            const box         = qEl.querySelector('[data-explanation-box]');
            if (!box) return;
            const ok = (chosen === answer);
            box.innerHTML = ok
                ? `<div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:8px;padding:12px;margin-top:8px;font-size:0.86rem;color:#86efac;">✅ 正确 — ${explanation}</div>`
                : `<div style="background:rgba(251,113,133,.06);border:1px solid rgba(251,113,133,.2);border-radius:8px;padding:12px;margin-top:8px;font-size:0.86rem;color:#fca5a5;">❌ 错误 — 正确答案是 <strong style="color:#f87171;">${answer}</strong>。${explanation}</div>`;
            box.style.display = 'block';
        }

        function hideExplanation(qEl) { hideBox(qEl.querySelector('[data-explanation-box]')); }
        function hideBox(box) { if (box) { box.innerHTML = ''; box.style.display = 'none'; } }

        /* ----- Main view update ----- */
        function updateView() {
            const questions = Array.from(quiz.querySelectorAll('[data-question-id]'));
            let answered = 0, correct = 0;
            const diffCount  = { basic: 0, mid: 0, hard: 0 };
            const diffCorrect = { basic: 0, mid: 0, hard: 0 };
            const diffTotal  = { basic: 0, mid: 0, hard: 0 };
            const wrongItems = [];

            questions.forEach(function (qEl) {
                const qid    = qEl.dataset.questionId;
                const answer = qEl.dataset.answer;
                const chosen = state.answers[qid];
                const diff   = qEl.dataset.difficulty || 'basic';
                const statusEl = qEl.querySelector('[data-status]');

                diffTotal[diff] = (diffTotal[diff] || 0) + 1;

                if (!chosen) {
                    if (statusEl) statusEl.textContent = '';
                    return;
                }

                answered++;
                diffCount[diff] = (diffCount[diff] || 0) + 1;
                const ok = (chosen === answer);
                if (ok) {
                    correct++;
                    diffCorrect[diff] = (diffCorrect[diff] || 0) + 1;
                    if (statusEl) statusEl.textContent = '✅';
                } else {
                    if (statusEl) statusEl.textContent = '❌';
                    const pEl = qEl.querySelector('p');
                    const qText = pEl
                        ? pEl.textContent.replace(/[✅❌]/g, '').replace(/\s+/g, ' ').trim()
                        : qid;
                    wrongItems.push({ qid, qText, chosen, answer, explanation: qEl.dataset.explanation || '' });
                }

                // Re-render explanation if already answered
                showExplanation(qEl, chosen);
            });

            const pct = answered === 0 ? 0 : Math.round(correct / answered * 100);
            if (statEl) statEl.textContent = `已答 ${answered}/${questions.length}，正确 ${correct}，正确率 ${pct}%`;
            if (diffStatEl) diffStatEl.textContent =
                `基础 ${diffCorrect.basic||0}/${diffTotal.basic||0} · 中级 ${diffCorrect.mid||0}/${diffTotal.mid||0} · 高级 ${diffCorrect.hard||0}/${diffTotal.hard||0}`;

            if (wrongListEl) {
                wrongListEl.innerHTML = '';
                if (wrongItems.length === 0) {
                    const li = document.createElement('li');
                    li.textContent = '当前没有错题，继续保持！';
                    wrongListEl.appendChild(li);
                } else {
                    wrongItems.forEach(function (item) {
                        const li = document.createElement('li');
                        li.style.cssText = 'list-style:none;margin:8px 0;padding:10px 12px;background:rgba(251,113,133,.06);border:1px solid rgba(251,113,133,.2);border-radius:8px;font-size:0.86rem;color:#fca5a5;';
                        li.innerHTML = `<strong>${item.qid}</strong>：${item.qText}<br>你选了 <del style="opacity:.7">${item.chosen}</del> → 正确答案 <strong style="color:#f87171;">${item.answer}</strong><br><span style="opacity:.85;">${item.explanation}</span>`;
                        wrongListEl.appendChild(li);
                    });
                }
            }
        }

        function persistState() { localStorage.setItem(`quiz_${key}`, JSON.stringify(state)); }
    });

    /* ===== HELPERS ===== */
    function loadState(key) {
        try {
            const raw = localStorage.getItem(`quiz_${key}`);
            if (!raw) return { answers: {} };
            const p = JSON.parse(raw);
            return (p && typeof p.answers === 'object') ? p : { answers: {} };
        } catch { return { answers: {} }; }
    }

    function restoreAnswers(root, answers) {
        Object.entries(answers).forEach(([name, value]) => {
            const inp = root.querySelector(`input[name="${name}"][value="${value}"]`);
            if (inp) inp.checked = true;
        });
    }
})();
