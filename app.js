// The app is static; a small local web server is needed only to fetch the JSON file.
let questions = [];
const groupSize = 30;
const randomTestSize = 30;
const storageKey = "driving-theory-trainer:car:v2";
const previousThemeStorageKey = "driving-theory-trainer:car:v1:theme";
const datasetBaseUrl = "https://raw.githubusercontent.com/tsoukalasdennis/greek-kok-dataset/main/";
const app = document.querySelector("#app");
const emptyProgress = {
  correctIds: [],
  mistakeIds: [],
  learnCompleted: [],
  testResults: {},
};

let progress = loadProgress();
let currentScreen = { name: "home" };
let session = null;
let storageWarning = "";
let theme = loadTheme();

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || typeof saved !== "object") {
      return { ...emptyProgress, testResults: {} };
    }
    return {
      correctIds: Array.isArray(saved.correctIds) ? saved.correctIds : [],
      mistakeIds: Array.isArray(saved.mistakeIds) ? saved.mistakeIds : [],
      learnCompleted: Array.isArray(saved.learnCompleted) ? saved.learnCompleted : [],
      testResults: saved.testResults && typeof saved.testResults === "object" ? saved.testResults : {},
    };
  } catch {
    storageWarning = "Saved progress could not be read. You can still use the app in this tab.";
    return { ...emptyProgress };
  }
}

function saveProgress() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(progress));
    storageWarning = "";
  } catch {
    storageWarning = "Progress could not be saved by this browser.";
  }
}

function loadTheme() {
  try {
    return localStorage.getItem(`${storageKey}:theme`)
      || localStorage.getItem(previousThemeStorageKey)
      || "light";
  } catch {
    return "light";
  }
}

function saveTheme() {
  try {
    localStorage.setItem(`${storageKey}:theme`, theme);
  } catch {
    // The theme still changes for this tab even if browser storage is unavailable.
  }
}

function unique(list, value) {
  return list.includes(value) ? list : [...list, value];
}

function groupsOf(items) {
  const groups = [];
  for (let i = 0; i < items.length; i += groupSize) {
    groups.push(items.slice(i, i + groupSize));
  }
  return groups;
}

function getQuestionGroups() {
  return groupsOf(questions);
}

function getMistakeGroups() {
  const mistakes = new Set(progress.mistakeIds);
  return groupsOf(questions.filter((question) => mistakes.has(question.id)));
}

function getCorrectAnswer(question) {
  return question.options[question.correctIndex];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function imageUrl(image) {
  return image
    ? new URL(image.split("/").map((segment) => encodeURIComponent(segment)).join("/"), datasetBaseUrl).href
    : "";
}

function overallProgress() {
  const correct = new Set(progress.correctIds);
  return questions.length ? Math.round((correct.size / questions.length) * 100) : 0;
}

function updateHeader() {
  const percent = overallProgress();
  const ring = document.querySelector("#progress-ring");
  ring.style.setProperty("--progress", `${percent}%`);
  ring.setAttribute("aria-valuenow", String(percent));
  document.querySelector("#progress-percent").textContent = `${percent}%`;
  document.documentElement.dataset.theme = theme;
}

function render() {
  updateHeader();
  if (currentScreen.name === "home") renderHome();
  else if (currentScreen.name === "learn") renderFlashcards();
  else if (currentScreen.name === "test") renderTest();
  else if (currentScreen.name === "results") renderResults();
}

function warningMarkup() {
  return storageWarning
    ? `<p class="storage-warning" role="status">${escapeHtml(storageWarning)}</p>`
    : "";
}

function renderHome() {
  const questionGroups = getQuestionGroups();
  const mistakeGroups = getMistakeGroups();
  const correctCount = new Set(progress.correctIds).size;
  const mistakeCount = progress.mistakeIds.length;

  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">Car driving theory</p>
        <h1>Greek kok theory<br>questions &amp; signs.</h1>
        <p class="hero-copy">A sample of the questions, answers and images in the dataset (car category).</p>
      </div>
      <dl class="stats">
        <div><dt>Questions</dt><dd>${questions.length}</dd></div>
        <div><dt>Answered correctly</dt><dd>${correctCount}</dd></div>
        <div><dt>Open mistakes</dt><dd>${mistakeCount}</dd></div>
      </dl>
    </section>
    <section class="section-card about-card" aria-labelledby="about-heading">
      <span class="section-icon about-icon" aria-hidden="true">i</span>
      <div>
        <h2 id="about-heading">About this dataset demo</h2>
        <p>This app is a sample to demonstrate the driving theory questions and images dataset. It is not a reliable or official road-sign learning app, so verify answers with current official sources. Your progress is saved only in this browser.</p>
      </div>
    </section>
    ${warningMarkup()}
    <section class="section-card">
      <div class="section-heading">
        <span class="section-icon" aria-hidden="true">▤</span>
        <div><h2>Study &amp; Quiz</h2><p>Choose how you want to practise each group.</p></div>
      </div>
      <div class="group-grid group-list is-collapsed" id="study-groups">${questionGroups.map((group, index) => {
        const groupNumber = index + 1;
        const learned = progress.learnCompleted.includes(groupNumber);
        const result = progress.testResults[groupNumber];
        const state = learned && result?.score === result?.total
          ? "done"
          : learned || result
            ? "partial"
            : "";
        return `
          <article class="mistake-tile group-tile-card">
            <div class="group-tile-info">
              <strong>Group ${groupNumber}</strong>
              <span>${group.length} ${group.length === 1 ? "question" : "questions"}</span>
              <span class="group-status">
                ${learned ? '<span class="status-complete">Studied</span>' : "Not studied"}
                <span aria-hidden="true"> · </span>
                ${result ? `Last score ${result.score}/${result.total}` : "No quiz yet"}
              </span>
            </div>
            <div class="tile-actions">
              <button class="button button-secondary" data-action="start-learn" data-group="${groupNumber}">Study</button>
              <button class="button ${state === "done" ? "button-success" : ""}" data-action="start-test" data-group="${groupNumber}">Quiz</button>
            </div>
          </article>
        `;
      }).join("")}</div>
      ${questionGroups.length > 3 ? `
        <button class="group-list-toggle" type="button" data-action="toggle-groups" data-remaining="${questionGroups.length - 3}" aria-controls="study-groups" aria-expanded="false">
          Show all groups (${questionGroups.length - 3} more) <span aria-hidden="true">↓</span>
        </button>
      ` : ""}
    </section>
    <section class="section-card random-test-card">
      <div class="section-heading">
        <span class="section-icon random-test-icon" aria-hidden="true">⤨</span>
        <div><h2>Random test</h2><p>A fresh set of ${Math.min(randomTestSize, questions.length)} questions, picked at random from all ${questions.length} questions.</p></div>
      </div>
      ${mistakeCount ? `
        <p class="random-test-lock"><span aria-hidden="true">🔒</span> Locked while you have ${mistakeCount} open mistake${mistakeCount === 1 ? "" : "s"}. You can still choose to continue.</p>
        <dialog class="random-test-dialog" id="random-test-confirmation" aria-labelledby="random-test-confirmation-title" aria-describedby="random-test-confirmation-message">
          <h2 id="random-test-confirmation-title">Open mistakes remain</h2>
          <p id="random-test-confirmation-message">It's not a good strategy to start a new random test while you still have open mistakes. Do you want to continue anyway?</p>
          <div class="result-actions">
            <button class="button button-secondary" type="button" data-action="cancel-random-test">No</button>
            <button class="button" type="button" data-action="confirm-random-test">Yes, continue</button>
          </div>
        </dialog>
      ` : ""}
      <button class="button" type="button" data-action="start-random-test">Start a new test <span aria-hidden="true">→</span></button>
    </section>
    ${mistakeCount ? `
      <section class="section-card">
        <div class="section-heading">
          <span class="section-icon mistake-icon" aria-hidden="true">↻</span>
          <div><h2>Practise your mistakes</h2><p>${mistakeCount} question${mistakeCount === 1 ? "" : "s"} to review.</p></div>
        </div>
        <div class="group-grid">${mistakeGroups.map((group, index) => `
          <article class="mistake-tile">
            <div><strong>Mistakes · Group ${index + 1}</strong><span>${group.length} ${group.length === 1 ? "question" : "questions"}</span></div>
            <div class="tile-actions">
              <button class="button button-secondary" data-action="start-mistake-learn" data-group="${index + 1}">Study</button>
              <button class="button" data-action="start-mistake-test" data-group="${index + 1}">Quiz</button>
            </div>
          </article>
        `).join("")}</div>
      </section>
    ` : ""}
    <footer class="page-footer">Your progress is saved only in this browser.</footer>
  `;
}

function startLearning(groupNumber, mistakesOnly = false) {
  const group = mistakesOnly
    ? getMistakeGroups()[groupNumber - 1] || []
    : getQuestionGroups()[groupNumber - 1] || [];
  if (!group.length) {
    currentScreen = { name: "empty-mistakes" };
    app.innerHTML = `
      <section class="completion-card">
        <span class="completion-icon">✓</span>
        <h1>No mistakes here</h1>
        <p>You've cleared every mistake in this group. Nice work.</p>
        <button class="button" data-action="home">Back to home</button>
      </section>`;
    return;
  }
  session = { type: mistakesOnly ? "mistake-learn" : "learn", groupNumber, questions: group, index: 0, flipped: false };
  currentScreen = { name: "learn" };
  render();
}

function startTest(groupNumber, mistakesOnly = false) {
  const group = mistakesOnly
    ? getMistakeGroups()[groupNumber - 1] || []
    : getQuestionGroups()[groupNumber - 1] || [];
  if (!group.length) {
    currentScreen = { name: "empty-mistakes" };
    app.innerHTML = `
      <section class="completion-card">
        <span class="completion-icon">✓</span>
        <h1>No mistakes here</h1>
        <p>You've cleared every mistake in this group. Nice work.</p>
        <button class="button" data-action="home">Back to home</button>
      </section>`;
    return;
  }
  session = {
    type: mistakesOnly ? "mistake-test" : "test",
    groupNumber,
    questions: group,
    index: 0,
    selectedIndex: null,
    answers: [],
    optionOrders: group.map((question) => shuffledIndices(question.options.length)),
  };
  currentScreen = { name: "test" };
  render();
}

function startRandomTest() {
  const testQuestions = shuffledIndices(questions.length)
    .slice(0, randomTestSize)
    .map((index) => questions[index]);
  session = {
    type: "random-test",
    questions: testQuestions,
    index: 0,
    selectedIndex: null,
    answers: [],
    optionOrders: testQuestions.map((question) => shuffledIndices(question.options.length)),
  };
  currentScreen = { name: "test" };
  render();
}

function shuffledIndices(length) {
  const indices = Array.from({ length }, (_, index) => index);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function sessionTitle() {
  if (session.type === "random-test") return "Random test";
  if (session.type === "mistake-learn") return `Mistakes · Learning · Group ${session.groupNumber}`;
  if (session.type === "mistake-test") return `Mistakes · Testing · Group ${session.groupNumber}`;
  if (session.type === "learn") return `Learning · Group ${session.groupNumber}`;
  return `Testing · Group ${session.groupNumber}`;
}

function renderSessionHeader() {
  const current = session.index + 1;
  const total = session.questions.length;
  return `
    <div class="session-heading">
      <button class="text-button" data-action="home">← Home</button>
      <span>${current} / ${total}</span>
    </div>
    <h1 class="session-title">${escapeHtml(sessionTitle())}</h1>
    <div class="session-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${current}" aria-label="Question ${current} of ${total}">
      <span style="width:${Math.round((current / total) * 100)}%"></span>
    </div>
  `;
}

function renderFlashcards() {
  const question = session.questions[session.index];
  const isLast = session.index === session.questions.length - 1;
  app.innerHTML = `
    <section class="session">
      ${renderSessionHeader()}
      <button class="flashcard ${session.flipped ? "is-flipped" : ""}" data-action="flip" aria-label="${session.flipped ? "Show question" : "Reveal answer"}">
        ${question.image ? `<img src="${imageUrl(question.image)}" alt="Road sign for this question" class="question-image">` : ""}
        <span class="card-question">${escapeHtml(question.question)}</span>
        <span class="card-answer ${session.flipped ? "" : "is-hidden"}"><span class="answer-label">Correct answer</span>${escapeHtml(getCorrectAnswer(question))}</span>
        <span class="card-hint">${session.flipped ? "Tap to see the question" : "Tap to reveal the answer"}</span>
      </button>
      <div class="session-controls">
        <button class="button button-secondary" data-action="previous" ${session.index === 0 ? "disabled" : ""}>← Previous</button>
        <span class="keyboard-hint">Use ← → arrow keys</span>
        <button class="button" data-action="next-card">${isLast ? "Finish" : "Next"} →</button>
      </div>
    </section>
  `;
}

function renderTest() {
  const question = session.questions[session.index];
  const isAnswered = session.selectedIndex !== null;
  const isLast = session.index === session.questions.length - 1;
  const correct = isAnswered && session.selectedIndex === question.correctIndex;
  const options = session.optionOrders[session.index];
  app.innerHTML = `
    <section class="session">
      ${renderSessionHeader()}
      <article class="quiz-card">
        ${question.image ? `<img src="${imageUrl(question.image)}" alt="Road sign for this question" class="question-image">` : ""}
        <h2>${escapeHtml(question.question)}</h2>
        <div class="answer-options">
          ${options.map((optionIndex, position) => {
            const isCorrect = optionIndex === question.correctIndex;
            const isSelected = optionIndex === session.selectedIndex;
            const stateClass = isAnswered && isCorrect ? "is-correct" : isAnswered && isSelected ? "is-wrong" : isAnswered ? "is-muted" : "";
            const symbol = isAnswered && isCorrect ? "✓" : isAnswered && isSelected ? "×" : String.fromCharCode(65 + position);
            return `<button class="answer-option ${stateClass}" data-action="choose" data-option="${optionIndex}" ${isAnswered ? "disabled" : ""}><span class="option-letter">${symbol}</span><span>${escapeHtml(question.options[optionIndex])}</span></button>`;
          }).join("")}
        </div>
        <p class="answer-feedback ${isAnswered ? correct ? "feedback-correct" : "feedback-wrong" : ""}" aria-live="polite">${isAnswered ? correct ? "Correct!" : `Incorrect. The answer is: ${escapeHtml(getCorrectAnswer(question))}` : ""}</p>
      </article>
      <div class="session-controls session-controls-end">
        <button class="button" data-action="next-question" ${isAnswered ? "" : "disabled"}>${isLast ? "See results" : "Next question"} →</button>
      </div>
    </section>
  `;
}

function chooseAnswer(optionIndex) {
  if (session.selectedIndex !== null) return;
  const question = session.questions[session.index];
  const isCorrect = optionIndex === question.correctIndex;
  session.selectedIndex = optionIndex;
  session.answers.push({ question, selectedIndex: optionIndex, correct: isCorrect });
  render();
}

function finishTest() {
  for (const answer of session.answers) {
    if (answer.correct) {
      progress.correctIds = unique(progress.correctIds, answer.question.id);
      if (session.type === "mistake-test") {
        progress.mistakeIds = progress.mistakeIds.filter((id) => id !== answer.question.id);
      }
    } else if (session.type === "test" || session.type === "random-test") {
      progress.mistakeIds = unique(progress.mistakeIds, answer.question.id);
    }
  }
  if (session.type === "test") {
    const score = session.answers.filter((answer) => answer.correct).length;
    progress.testResults[session.groupNumber] = { score, total: session.questions.length };
  }
  saveProgress();
  currentScreen = { name: "results" };
  render();
}

function renderResults() {
  const score = session.answers.filter((answer) => answer.correct).length;
  const total = session.answers.length;
  const percent = total ? Math.round((score / total) * 100) : 0;
  const wrongAnswers = session.answers.filter((answer) => !answer.correct);
  const mistakeGroupStillHasQuestions = (getMistakeGroups()[session.groupNumber - 1] || []).length > 0;
  app.innerHTML = `
    <section class="session results">
      <article class="result-card">
        <p class="eyebrow">Your score</p>
        <p class="score">${score}<span>/${total}</span></p>
        <span class="score-badge ${percent >= 80 ? "score-good" : "score-low"}">${percent}% correct</span>
        <div class="result-actions">
          <button class="button button-secondary" data-action="home">Back to home</button>
          <button class="button" data-action="retry" ${session.type === "mistake-test" && !mistakeGroupStillHasQuestions ? "disabled" : ""}>${session.type === "random-test" ? "↻ New random test" : "↻ Retry group"}</button>
        </div>
        ${session.type === "mistake-test" ? `<p class="muted">${mistakeGroupStillHasQuestions ? `${(getMistakeGroups()[session.groupNumber - 1] || []).length} mistakes left in this group.` : "All mistakes in this group are cleared."}</p>` : ""}
      </article>
      ${wrongAnswers.length ? `
        <section class="review-section">
          <h2>Review your mistakes</h2>
          <div class="review-list">${wrongAnswers.map(({ question, selectedIndex }) => `
            <article class="review-item">
              ${question.image ? `<img src="${imageUrl(question.image)}" alt="" class="review-image">` : ""}
              <div><h3>${escapeHtml(question.question)}</h3><p class="review-wrong">Your answer: ${escapeHtml(question.options[selectedIndex])}</p><p class="review-correct">Correct answer: ${escapeHtml(getCorrectAnswer(question))}</p></div>
            </article>
          `).join("")}</div>
        </section>
      ` : ""}
    </section>
  `;
}

function nextCard() {
  if (session.index === session.questions.length - 1) {
    if (session.type === "learn") {
      progress.learnCompleted = unique(progress.learnCompleted, session.groupNumber);
      saveProgress();
    }
    currentScreen = { name: "learn-finished" };
    renderFinishedLearning();
    return;
  }
  session.index += 1;
  session.flipped = false;
  render();
}

function renderFinishedLearning() {
  const isMistakeStudy = session.type === "mistake-learn";
  const isLast = session.groupNumber >= (isMistakeStudy ? getMistakeGroups().length : getQuestionGroups().length);
  const nextAction = isMistakeStudy
    ? `<button class="button" data-action="start-mistake-test" data-group="${session.groupNumber}">Test these mistakes →</button>`
    : `<button class="button" data-action="${isLast ? "start-test" : "start-learn"}" data-group="${isLast ? session.groupNumber : session.groupNumber + 1}">${isLast ? `Test Group ${session.groupNumber}` : `Continue to Group ${session.groupNumber + 1}`} →</button>`;
  app.innerHTML = `
    <section class="completion-card">
      <span class="completion-icon">✓</span>
      <h1>Group complete</h1>
      <p>You reviewed all ${session.questions.length} cards in ${escapeHtml(sessionTitle())}.</p>
      <div class="result-actions">
        <button class="button button-secondary" data-action="review-again">Review again</button>
        <button class="button button-secondary" data-action="home">Back to home</button>
        ${nextAction}
      </div>
    </section>
  `;
}

function handleAction(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const groupNumber = Number(target.dataset.group);
  if (action === "home") {
    currentScreen = { name: "home" };
    session = null;
    render();
  } else if (action === "start-learn") startLearning(groupNumber);
  else if (action === "start-test") startTest(groupNumber);
  else if (action === "start-random-test") {
    if (progress.mistakeIds.length) {
      document.querySelector("#random-test-confirmation").showModal();
    } else {
      startRandomTest();
    }
  } else if (action === "confirm-random-test") {
    document.querySelector("#random-test-confirmation").close();
    startRandomTest();
  } else if (action === "cancel-random-test") {
    document.querySelector("#random-test-confirmation").close();
  } else if (action === "start-mistake-learn") startLearning(groupNumber, true);
  else if (action === "start-mistake-test") startTest(groupNumber, true);
  else if (action === "toggle-groups") {
    const groupList = document.querySelector("#study-groups");
    const expanded = groupList.classList.toggle("is-expanded");
    groupList.classList.toggle("is-collapsed", !expanded);
    target.setAttribute("aria-expanded", String(expanded));
    target.innerHTML = expanded
      ? 'Show fewer groups <span aria-hidden="true">↑</span>'
      : `Show all groups (${target.dataset.remaining} more) <span aria-hidden="true">↓</span>`;
  } else if (action === "flip") {
    session.flipped = !session.flipped;
    render();
  } else if (action === "previous") {
    session.index = Math.max(0, session.index - 1);
    session.flipped = false;
    render();
  } else if (action === "next-card") nextCard();
  else if (action === "choose") chooseAnswer(Number(target.dataset.option));
  else if (action === "next-question") {
    if (session.index === session.questions.length - 1) finishTest();
    else {
      session.index += 1;
      session.selectedIndex = null;
      render();
    }
  } else if (action === "retry") {
    if (session.type === "mistake-test") startTest(session.groupNumber, true);
    else if (session.type === "random-test") startRandomTest();
    else startTest(session.groupNumber);
  } else if (action === "review-again") {
    startLearning(session.groupNumber, session.type === "mistake-learn");
  } else if (action === "theme") {
    theme = theme === "dark" ? "light" : "dark";
    saveTheme();
    updateHeader();
  } else if (action === "reset") {
    if (window.confirm("Reset all saved progress? This cannot be undone.")) {
      progress = { ...emptyProgress, testResults: {} };
      saveProgress();
      currentScreen = { name: "home" };
      session = null;
      render();
    }
  }
}

document.addEventListener("click", handleAction);

document.addEventListener("keydown", (event) => {
  if (currentScreen.name !== "learn" || !session) return;
  if (event.key === "ArrowRight") nextCard();
  if (event.key === "ArrowLeft" && session.index > 0) {
    session.index -= 1;
    session.flipped = false;
    render();
  }
});

window.addEventListener("storage", (event) => {
  if (event.key === storageKey) {
    progress = loadProgress();
    render();
  }
});

function normalizeQuestion(record, index) {
  const label = `questions_car.json entry ${index + 1}`;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`${label} must be an object.`);
  }

  const id = String(record.id ?? "").trim();
  const question = typeof record.question === "string" ? record.question.trim() : "";
  const correctAnswer = typeof record.correct_answer === "string"
    ? record.correct_answer.trim()
    : "";
  const distractors = record.distractors;
  const imagePath = record.image_path;

  if (!id || !question || !correctAnswer) {
    throw new Error(`${label} must include id, question, and correct_answer.`);
  }
  if (!Array.isArray(distractors) || distractors.length === 0 ||
      distractors.some((answer) => typeof answer !== "string" || !answer.trim())) {
    throw new Error(`${label} must include at least one non-empty distractor.`);
  }
  if (imagePath !== null && typeof imagePath !== "string") {
    throw new Error(`${label} image_path must be a string or null.`);
  }

  const image = imagePath ? imagePath.replace(/\\/g, "/") : null;
  if (image && (!image.startsWith("assets/images/car/") ||
      image.split("/").some((segment) => !segment || segment === "." || segment === ".."))) {
    throw new Error(`${label} image_path must point to an image in assets/images/car/.`);
  }

  return {
    id,
    question,
    options: [correctAnswer, ...distractors.map((answer) => answer.trim())],
    correctIndex: 0,
    image,
  };
}

async function loadQuestions() {
  app.innerHTML = `<p role="status">Loading questions…</p>`;
  try {
    const response = await fetch(`${datasetBaseUrl}questions_car.json`);
    if (!response.ok) {
      throw new Error(`The question file returned HTTP ${response.status}.`);
    }
    const records = await response.json();
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error("questions_car.json must contain a non-empty array.");
    }
    const ids = new Set();
    questions = records.map((record, index) => {
      const question = normalizeQuestion(record, index);
      if (ids.has(question.id)) {
        throw new Error(`Question ID "${question.id}" appears more than once.`);
      }
      ids.add(question.id);
      return question;
    });
    render();
  } catch (error) {
    console.error("Could not load questions_car.json:", error);
    app.innerHTML = `
      <section class="completion-card">
        <h1>Could not load the questions</h1>
        <p>${escapeHtml(error instanceof Error ? error.message : "Unknown error")}</p>
        <p>Open this folder using a local web server, then reload the page.</p>
      </section>`;
  }
}

if (location.protocol === "file:") {
  app.innerHTML = `
    <section class="completion-card">
      <h1>Start a local web server</h1>
      <p>The browser does not allow this page to read its JSON file when opened directly.</p>
      <p>Open this folder in VS Code and use the Live Server extension, then visit its local address.</p>
    </section>`;
} else {
  loadQuestions();
}
