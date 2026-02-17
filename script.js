const cityData = [
  { city: "Lisbon", country: "Portugal", rent: 1350, food: 430, transport: 70, insurance: 160, taxRate: 0.26, visa: 3000 },
  { city: "Porto", country: "Portugal", rent: 980, food: 370, transport: 55, insurance: 150, taxRate: 0.24, visa: 2600 },
  { city: "Barcelona", country: "Spain", rent: 1600, food: 460, transport: 70, insurance: 180, taxRate: 0.28, visa: 3200 },
  { city: "Valencia", country: "Spain", rent: 1150, food: 390, transport: 55, insurance: 165, taxRate: 0.25, visa: 2800 },
  { city: "Berlin", country: "Germany", rent: 1750, food: 470, transport: 95, insurance: 230, taxRate: 0.29, visa: 3600 },
  { city: "Toronto", country: "Canada", rent: 2050, food: 540, transport: 120, insurance: 240, taxRate: 0.3, visa: 4200 }
];

const steps = [
  { title: "About You", fields: ["originCountry", "currentCity", "familyStatus"] },
  { title: "Financial Profile", fields: ["income", "savings", "stability"] },
  { title: "Relocation Goal", fields: ["targetCity", "timeline", "reason"] },
  { title: "Lifestyle Expectations", fields: ["lifestyle", "housing", "risk"] },
  { title: "Confirm & Run Analysis", fields: [] }
];

const state = {
  originCountry: "", currentCity: "", familyStatus: "Alone", income: 0, savings: 0,
  stability: "Yes", targetCity: "Lisbon", timeline: "1–3 months", reason: "Lifestyle",
  lifestyle: "Standard", housing: "Studio", risk: "Balanced"
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
let currentStep = 0;
let latest = null;

const stepContainer = document.getElementById("step-container");
const stepLabel = document.getElementById("step-label");
const stepTitle = document.getElementById("step-title");
const progressBar = document.getElementById("progress-bar");
const backBtn = document.getElementById("back-btn");
const nextBtn = document.getElementById("next-btn");
const loader = document.getElementById("analysis-loader");

const screens = {
  onboarding: document.getElementById("onboarding-screen"),
  analysis: document.getElementById("analysis-screen")
};

function renderStep() {
  const step = steps[currentStep];
  stepLabel.textContent = `Step ${currentStep + 1} of ${steps.length}`;
  stepTitle.textContent = step.title;
  progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
  backBtn.style.visibility = currentStep === 0 ? "hidden" : "visible";
  nextBtn.textContent = currentStep === steps.length - 1 ? "Run My Relocation Intelligence" : "Continue";

  const cityOptions = cityData.map(c => `<option value="${c.city}">${c.city}, ${c.country}</option>`).join("");
  const stepViews = [
    `<div class="step"><div class="step-grid">
      <label>Country of origin<input data-key="originCountry" value="${state.originCountry}" placeholder="e.g. Brazil" /></label>
      <label>Current city<input data-key="currentCity" value="${state.currentCity}" placeholder="e.g. São Paulo" /></label>
      ${choice("Are you moving alone or with others?", "familyStatus", ["Alone", "Partner", "Family (with children)"])}
    </div></div>`,
    `<div class="step"><div class="step-grid">
      <label>Monthly income (USD)<input data-key="income" type="number" min="0" value="${state.income || ""}" /></label>
      <label>Savings (USD)<input data-key="savings" type="number" min="0" value="${state.savings || ""}" /></label>
      ${choice("Remote income stable?", "stability", ["Yes", "No", "Freelance"])}
    </div></div>`,
    `<div class="step"><div class="step-grid">
      <label>Target city<select data-key="targetCity">${cityOptions}</select></label>
      ${choice("Timeline", "timeline", ["1–3 months", "3–6 months", "6–12 months"])}
      ${choice("Why are you moving?", "reason", ["Lifestyle", "Lower cost", "Career", "Adventure"])}
    </div></div>`,
    `<div class="step"><div class="step-grid">
      ${choice("Lifestyle level", "lifestyle", ["Basic", "Standard", "Comfortable"])}
      ${choice("Housing preference", "housing", ["Shared", "Studio", "1-bedroom"])}
      ${choice("Risk tolerance", "risk", ["Conservative", "Balanced", "Aggressive"])}
    </div></div>`,
    `<div class="step"><div class="step-grid"><h3>Ready to run your analysis?</h3>
      <p>We will model your costs, stress scenarios, visa fit, and strategic timeline in one intelligence report.</p>
      <ul><li>Financial stability map</li><li>Runway and stress tests</li><li>Move strategy blueprint</li></ul>
    </div></div>`
  ];

  stepContainer.innerHTML = stepViews[currentStep];
  const select = stepContainer.querySelector('select[data-key="targetCity"]');
  if (select) select.value = state.targetCity;
  bindInputs();
}

function choice(label, key, options) {
  return `<div><p>${label}</p><div class="choice-group">${options.map(op => `<button type="button" data-choice="${key}" data-value="${op}" class="${state[key] === op ? "active" : ""}">${op}</button>`).join("")}</div></div>`;
}

function bindInputs() {
  stepContainer.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", () => {
      state[el.dataset.key] = el.type === "number" ? Number(el.value) : el.value;
    });
  });
  stepContainer.querySelectorAll("[data-choice]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.choice;
      state[key] = btn.dataset.value;
      renderStep();
    });
  });
}

function validateStep() {
  if (currentStep === 0) return state.originCountry && state.currentCity;
  if (currentStep === 1) return state.income > 0 && state.savings >= 0;
  return true;
}

backBtn.addEventListener("click", () => { currentStep -= 1; renderStep(); });
nextBtn.addEventListener("click", async () => {
  if (!validateStep()) return;
  if (currentStep < steps.length - 1) {
    currentStep += 1;
    renderStep();
    return;
  }
  await runAnalysisSequence();
});

async function runAnalysisSequence() {
  const lines = [
    "Analyzing cost structures...",
    "Running financial stability model...",
    "Simulating stress scenarios...",
    "Evaluating visa compatibility...",
    "Generating AI advisory report..."
  ];
  loader.hidden = false;
  for (const line of lines) {
    document.getElementById("loader-line").textContent = line;
    await new Promise(r => setTimeout(r, 850));
  }
  loader.hidden = true;
  screens.onboarding.classList.remove("active");
  screens.analysis.classList.add("active");
  latest = computeReport();
  renderAnalysis(latest);
  setupAdvisor(latest);
}

function computeReport() {
  const city = cityData.find(c => c.city === state.targetCity) || cityData[0];
  const lifestyleFactor = { Basic: 0.87, Standard: 1, Comfortable: 1.22 }[state.lifestyle];
  const housingFactor = { Shared: 0.82, Studio: 1, "1-bedroom": 1.18 }[state.housing];
  const familyFactor = { Alone: 1, Partner: 1.34, "Family (with children)": 1.7 }[state.familyStatus];

  const baseCost = (city.rent + city.food + city.transport + city.insurance) * lifestyleFactor * housingFactor * familyFactor;
  const tax = state.income * city.taxRate;
  const net = state.income - tax - baseCost;
  const runway = net < 0 ? state.savings / Math.abs(net) : Infinity;

  const scenarioA = state.income * 0.8 - state.income * 0.8 * city.taxRate - baseCost;
  const scenarioB = state.income - tax - (baseCost + city.rent * 0.15);
  const scenarioC = state.income * 0.8 - state.income * 0.8 * city.taxRate - (baseCost + city.rent * 0.15);

  const visaPass = state.income >= city.visa;
  const readiness = Math.max(10, Math.min(97, Math.round(((net + 1700) / 3200) * 55 + (visaPass ? 25 : 8) + (state.risk === "Conservative" ? 15 : state.risk === "Balanced" ? 9 : 4))));

  const alternatives = cityData
    .filter(c => c.city !== city.city)
    .map(c => {
      const altCost = (c.rent + c.food + c.transport + c.insurance) * lifestyleFactor * housingFactor * familyFactor;
      return { city: c.city, savings: Math.round(baseCost - altCost) };
    })
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 2);

  return { city, baseCost, tax, net, runway, scenarioA, scenarioB, scenarioC, visaPass, readiness, alternatives };
}

function renderAnalysis(r) {
  document.getElementById("analysis-title").textContent = `Your Relocation Intelligence Report for ${r.city.city}`;
  animateScore(r.readiness);
  document.getElementById("score-summary").textContent = r.readiness >= 75 ? "Strong position with manageable risks." : r.readiness >= 50 ? "Promising, but requires targeted prep." : "High risk profile—stabilize before moving.";

  setHtml("section-summary", `<h3>🧭 Executive Summary</h3>
    <p>With your current income of <strong>${usd.format(state.income)}</strong> and savings of <strong>${usd.format(state.savings)}</strong>, this move to ${r.city.city} is modeled as a <strong>${r.net > 0 ? "controlled" : "stretched"}</strong> transition. As someone relocating from ${state.originCountry}, your strongest lever is disciplined housing and timeline execution.</p>
    <p class="insight">Bold insight: ${r.net > 400 ? "You can move with confidence if you protect your cash buffer." : "Your move is possible, but only with a tighter pre-move financial plan."}</p>`);

  const maxBar = Math.max(state.income, r.baseCost, r.tax, Math.abs(r.net));
  setHtml("section-financial", `<h3>📊 Financial Stability Map</h3><div class="bars">
    ${bar("Income", state.income, maxBar)}${bar("Total Cost", r.baseCost, maxBar)}${bar("Tax", r.tax, maxBar)}${bar("Net Surplus", Math.max(0, r.net), maxBar)}
  </div>`);

  setHtml("section-runway", `<h3>⏳ Survival & Runway</h3>
    <p>You can sustain this plan for <strong class="${r.runway < 5 ? "bad" : "good"}">${Number.isFinite(r.runway) ? `${r.runway.toFixed(1)} months` : "Long-term stable runway"}</strong>.</p>
    <p class="insight ${r.runway < 5 ? "bad" : "good"}">${r.net < 0 ? "Warning: monthly burn detected—delay or downshift expenses." : "Green signal: you are operating with positive monthly resilience."}</p>`);

  setHtml("section-stress", `<h3>⚠️ Stress Test Simulation</h3><div class="card-grid">
    ${stressCard("Income -20%", r.scenarioA)}${stressCard("Rent +15%", r.scenarioB)}${stressCard("Combined shock", r.scenarioC)}
  </div>`);

  setHtml("section-visa", `<h3>🛂 Visa & Legal Fit</h3>
    <p class="insight ${r.visaPass ? "good" : "bad"}">${r.visaPass ? "PASS" : "FAIL"} — ${r.visaPass ? "Your income clears the threshold." : `You are below the ${usd.format(r.city.visa)} requirement.`}</p>
    <ul><li>Document trail strength should match your timeline of ${state.timeline}.</li><li>Freelance and unstable income profiles need stronger bank-history proof.</li></ul>`);

  setHtml("section-strategy", `<h3>🧠 Relocation Strategy Blueprint</h3>
    <ul><li>${state.familyStatus === "Family (with children)" ? "Prioritize school-safe districts and healthcare access over city-center location." : "Use flexibility to optimize rent and commute trade-offs."}</li>
    <li>Given your ${state.risk.toLowerCase()} risk tolerance, keep at least ${usd.format(r.baseCost * (state.risk === "Aggressive" ? 3 : 6))} liquid before committing.</li>
    <li>With a ${state.timeline} timeline, lock legal docs and housing shortlist in the next 30 days.</li></ul>`);

  setHtml("section-alternatives", `<h3>🌍 Smarter Alternatives</h3><div class="card-grid">
    ${r.alternatives.map(a => `<div class="card"><strong>${a.city}</strong><p>Estimated monthly savings: ${usd.format(a.savings)}</p></div>`).join("")}
  </div>`);

  const call = r.readiness >= 75 ? "Move Now" : r.readiness >= 50 ? "Prepare 3–6 Months" : "Reconsider Strategy";
  setHtml("section-final", `<h3>✅ Final Recommendation</h3><p class="insight">${call}</p><p>Your profile says: act decisively, but protect optionality.</p>`);

  setTimeout(() => document.querySelectorAll(".reveal").forEach((el, i) => setTimeout(() => el.classList.add("visible"), i * 110)), 100);
}

function bar(label, value, max) {
  return `<div class="bar-row"><span>${label}<strong>${usd.format(value)}</strong></span><div class="bar-track"><div class="bar-fill" style="width:${(value / max) * 100}%"></div></div></div>`;
}

function stressCard(label, net) {
  return `<div class="card"><strong>${label}</strong><p class="${net >= 0 ? "good" : "bad"}">${net >= 0 ? "Resilient" : "Pressure detected"}</p><p>Net: ${usd.format(net)}</p></div>`;
}

function animateScore(target) {
  const ring = document.getElementById("score-ring");
  const val = document.getElementById("score-value");
  let cur = 0;
  const timer = setInterval(() => {
    cur += 1;
    val.textContent = cur;
    ring.style.background = `conic-gradient(#5988ff ${cur * 3.6}deg, rgba(255,255,255,0.08) 0deg)`;
    if (cur >= target) clearInterval(timer);
  }, 16);
}

function setupAdvisor(r) {
  const q = {
    "Where am I most financially exposed?": `• Your highest pressure point is housing + tax drag.\n• Monthly surplus is ${usd.format(r.net)}.\n• Protect a hard cap on rent and pre-negotiate move-in costs.`,
    "How can I improve my runway?": `• Increase runway by reducing housing tier for 90 days.\n• Build savings to ${usd.format(r.baseCost * 6)} minimum.\n• Keep variable spending under 12% of income.`,
    "What income should I target?": `• Target ${usd.format(r.baseCost / (1 - r.city.taxRate) + 900)} monthly.\n• This creates healthy buffer for disruptions.`,
    "What’s the biggest risk in this move?": `• The largest risk is timeline-compressed relocation with limited buffer.\n• With your current numbers, a 20% income dip is ${usd.format(r.scenarioA)} net.`,
    "What if my income drops?": `• At -20% income, projected net is ${usd.format(r.scenarioA)}.\n• Delay move if this stays negative for more than 2 months.`,
    "Am I overestimating my stability?": `• If your income is ${state.stability === "Yes" ? "contract-stable" : "variable"}, assume 10-20% volatility.\n• Rebuild plan using conservative case before booking.`,
    "Is this city realistic with children?": `• For ${state.familyStatus}, this city is ${r.net > 300 ? "viable" : "tight"}.\n• Prioritize school-zone housing and childcare pricing.`,
    "How does family status change my budget?": `• Family profile raises baseline costs significantly.\n• Your modeled monthly cost is ${usd.format(r.baseCost)} with your current setup.`,
    "Should I wait 6 months?": `• If you can increase savings by ${usd.format(Math.max(0, r.baseCost * 6 - state.savings))}, waiting 6 months improves confidence.`,
    "What should I do before buying a ticket?": `• Lock visa paperwork.\n• Confirm first 60-day housing.\n• Build emergency liquidity to ${usd.format(r.baseCost * 4)} minimum.`,
    "Give me a 30-day relocation action plan.": `• Week 1: budget hard reset + document checklist.\n• Week 2: housing negotiations + legal prep.\n• Week 3: stress-test income channels.\n• Week 4: final go/no-go review.`,
    "What documents should I prepare?": `• Passport validity, income proof, bank statements, insurance, lease docs, tax records.\n• Keep notarized scans and translated copies ready.`
  };

  const container = document.getElementById("advisor-buttons");
  const reply = document.getElementById("advisor-reply");
  container.innerHTML = "";
  Object.keys(q).forEach(text => {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.addEventListener("click", () => { reply.textContent = q[text]; });
    container.appendChild(btn);
  });
}

function setHtml(id, html) { document.getElementById(id).innerHTML = html; }

renderStep();
