const cityData = [
  { city: "Lisbon", country: "Portugal", rent: 1350, food: 430, transport: 70, insurance: 160, coworking: 190, taxRate: 0.26, visaIncomeRequirement: 3000, riskLevel: "Low" },
  { city: "Porto", country: "Portugal", rent: 980, food: 370, transport: 55, insurance: 150, coworking: 160, taxRate: 0.24, visaIncomeRequirement: 2600, riskLevel: "Low" },
  { city: "Barcelona", country: "Spain", rent: 1600, food: 460, transport: 70, insurance: 180, coworking: 200, taxRate: 0.28, visaIncomeRequirement: 3200, riskLevel: "Medium" },
  { city: "Valencia", country: "Spain", rent: 1150, food: 390, transport: 55, insurance: 165, coworking: 160, taxRate: 0.25, visaIncomeRequirement: 2800, riskLevel: "Low" },
  { city: "Berlin", country: "Germany", rent: 1750, food: 470, transport: 95, insurance: 230, coworking: 220, taxRate: 0.29, visaIncomeRequirement: 3600, riskLevel: "Low" },
  { city: "Amsterdam", country: "Netherlands", rent: 1900, food: 510, transport: 115, insurance: 210, coworking: 240, taxRate: 0.31, visaIncomeRequirement: 3800, riskLevel: "Low" },
  { city: "Paris", country: "France", rent: 2050, food: 520, transport: 95, insurance: 230, coworking: 260, taxRate: 0.31, visaIncomeRequirement: 3900, riskLevel: "Medium" },
  { city: "Toronto", country: "Canada", rent: 2050, food: 540, transport: 120, insurance: 240, coworking: 250, taxRate: 0.3, visaIncomeRequirement: 4200, riskLevel: "Low" },
  { city: "Sydney", country: "Australia", rent: 2200, food: 590, transport: 130, insurance: 250, coworking: 270, taxRate: 0.32, visaIncomeRequirement: 4600, riskLevel: "Low" },
  { city: "Austin", country: "USA", rent: 1900, food: 560, transport: 120, insurance: 330, coworking: 250, taxRate: 0.27, visaIncomeRequirement: 4200, riskLevel: "Low" },
  { city: "Miami", country: "USA", rent: 2300, food: 610, transport: 140, insurance: 340, coworking: 280, taxRate: 0.28, visaIncomeRequirement: 4500, riskLevel: "Medium" }
];

const lifestyleMultipliers = { Basic: 0.88, Standard: 1, Comfortable: 1.24 };
const riskMap = { Low: 90, Medium: 70, High: 45 };

const citySelect = document.getElementById("city");
const form = document.getElementById("calculator-form");
const outputGrid = document.getElementById("output-grid");
const verdictBadge = document.getElementById("verdict-badge");
const reportRoot = document.getElementById("report-root");
const loadingState = document.getElementById("loading-state");
const resultIntro = document.getElementById("result-intro");
const quickActions = document.getElementById("quick-actions");
const chatPanel = document.getElementById("chat-panel");
const chatMessages = document.getElementById("chat-messages");
const chatQuestions = document.getElementById("chat-questions");

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

let latest = null;

citySelect.innerHTML = cityData
  .sort((a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city))
  .map((item) => `<option value="${item.city}">${item.city}, ${item.country}</option>`)
  .join("");

function formatRunway(v) {
  return Number.isFinite(v) ? `${v.toFixed(1)} months` : "Stable (no monthly burn)";
}

function computeRunway(savings, netAfterCosts) {
  return netAfterCosts < 0 ? savings / Math.abs(netAfterCosts) : Infinity;
}

function getVerdict(net) {
  if (net >= 1100) return { label: "Sustainable", className: "good" };
  if (net >= 150) return { label: "Tight", className: "warn" };
  return { label: "Not Realistic", className: "bad" };
}

function scoreReadiness(data) {
  const margin = Math.max(0, Math.min(100, ((data.netAfterCosts + 1200) / 2400) * 100));
  const runway = data.runwayMonths === Infinity ? 100 : Math.max(0, Math.min(100, (data.runwayMonths / 12) * 100));
  const visa = data.visaPass ? 100 : Math.max(0, 100 + (data.income - data.city.visaIncomeRequirement) / 25);
  const risk = riskMap[data.city.riskLevel] || 60;
  const weighted = margin * 0.4 + runway * 0.25 + visa * 0.2 + risk * 0.15;

  return {
    total: Math.round(weighted),
    breakdown: { margin: Math.round(margin), runway: Math.round(runway), visa: Math.round(visa), risk }
  };
}

function getScenario(income, costs, taxRate, savings) {
  const tax = income * taxRate;
  const net = income - costs - tax;
  return { net, runway: computeRunway(savings, net) };
}

function getCheaperAlternatives(currentCity, multiplier, totalCost, income, savings, taxRate) {
  return cityData
    .filter((c) => c.city !== currentCity.city)
    .map((c) => {
      const cityCost = (c.rent + c.food + c.transport + c.insurance + c.coworking) * multiplier;
      const net = income - cityCost - income * c.taxRate;
      const runway = computeRunway(savings, net);
      return {
        city: c,
        totalCost: cityCost,
        monthlyDiff: totalCost - cityCost,
        runway
      };
    })
    .filter((c) => c.totalCost < totalCost)
    .sort((a, b) => a.totalCost - b.totalCost)
    .slice(0, 2);
}

function section(title, content, open = false) {
  const expanded = window.matchMedia("(min-width: 980px)").matches || open;
  return `<details class="report-section" ${expanded ? "open" : ""}><summary>${title}<span>▾</span></summary><div class="section-content">${content}</div></details>`;
}

function buildActionPlan(state) {
  const { verdict, netAfterCosts, income, totalCost, savings, runwayMonths, city, alternatives } = state;
  if (verdict.label === "Not Realistic") {
    return [
      `Shift lifestyle from ${state.lifestyle} to Basic to reduce modeled spend by roughly ${usd.format(totalCost - state.baseTotal * lifestyleMultipliers.Basic)} monthly.`,
      `Target a minimum income of ${usd.format(city.visaIncomeRequirement + 500)} to clear visa and create breathing room.`,
      `Build savings toward ${usd.format(Math.max(savings, totalCost * 6))} for a 6-month buffer before moving.`,
      alternatives[0] ? `Consider ${alternatives[0].city.city} first; that alone saves around ${usd.format(alternatives[0].monthlyDiff)} per month.` : "Evaluate lower-cost cities before committing to this move."
    ];
  }
  if (verdict.label === "Tight") {
    return [
      `Cap rent at ${(city.rent * 0.9).toFixed(0)}–${city.rent.toFixed(0)} USD to preserve at least ${usd.format(300)} monthly flexibility.`,
      `Set hard limits: food ${usd.format(city.food * 0.9)}, transport ${usd.format(city.transport)}, discretionary coworking review monthly.`,
      `Increase runway to at least 6 months (target savings ${usd.format(Math.max(totalCost * 6, savings))}).`,
      `Create a downside plan now since stress scenarios can turn your ${usd.format(netAfterCosts)} surplus negative.`
    ];
  }
  return [
    `Keep your current plan, but ring-fence 2 months of income (${usd.format(income * 2)}) as relocation reserve.`,
    `Before moving, lock health insurance details and tax filing obligations for ${city.city}.`,
    `Use your surplus to pre-fund visa, deposits, and setup costs instead of lifestyle inflation.`,
    `Review your plan every quarter against actual rent and tax changes.`
  ];
}

function buildReport(state) {
  const emergencyFund = state.totalCost * 6;
  const runwayDelta = state.worst.runway === Infinity ? "Stable" : `${state.worst.runway.toFixed(1)} months`;
  const cheaperRows = state.alternatives.length
    ? state.alternatives
        .map(
          (a) => `<tr><td>${a.city.city}</td><td>${usd.format(a.totalCost)}</td><td>${usd.format(a.monthlyDiff)}</td><td>${formatRunway(a.runway)}</td></tr>`
        )
        .join("")
    : "<tr><td colspan=\"4\">No cheaper city found in this dataset.</td></tr>";

  return [
    section(
      "Executive Summary",
      `<p>For ${state.city.city}, your profile lands at <strong>${state.verdict.label}</strong> with a readiness score of <strong>${state.score.total}/100</strong>.</p>
      <ul>
        <li>You earn ${usd.format(state.income)} and spend an estimated ${usd.format(state.totalCost)} monthly before tax.</li>
        <li>After estimated tax (${usd.format(state.estimatedTax)}), your net monthly result is ${usd.format(state.netAfterCosts)}.</li>
        <li>Your current savings (${usd.format(state.savings)}) support ${formatRunway(state.runwayMonths)} under current assumptions.</li>
        <li>In worst-case stress (income -20% + rent +15%), your net becomes ${usd.format(state.worst.net)}.</li>
      </ul>
      <p class="why">Why it matters: this view combines everyday affordability and downside resilience, not just headline rent.</p>`,
      true
    ),
    section(
      "Monthly Budget Breakdown",
      `<table class="metric-table">
        <tr><th>Cost Item</th><th>Monthly (Adjusted)</th></tr>
        <tr><td>Rent</td><td>${usd.format(state.city.rent * state.multiplier)}</td></tr>
        <tr><td>Food</td><td>${usd.format(state.city.food * state.multiplier)}</td></tr>
        <tr><td>Transport</td><td>${usd.format(state.city.transport * state.multiplier)}</td></tr>
        <tr><td>Insurance</td><td>${usd.format(state.city.insurance * state.multiplier)}</td></tr>
        <tr><td>Coworking</td><td>${usd.format(state.city.coworking * state.multiplier)}</td></tr>
        <tr><th>Total Living Cost</th><th>${usd.format(state.totalCost)}</th></tr>
      </table>
      <ul><li>Rent is your largest controllable expense at ${usd.format(state.city.rent * state.multiplier)} per month.</li><li>With a ${state.lifestyle} profile, lifestyle inflation adds ${usd.format(state.totalCost - state.baseTotal)} versus Standard.</li></ul>
      <p class="why">Why it matters: if one line item drifts up, your safety margin narrows quickly.</p>`
    ),
    section(
      "Tax & Take-Home",
      `<table class="metric-table"><tr><td>Estimated Tax Rate</td><td>${Math.round(state.city.taxRate * 100)}%</td></tr><tr><td>Estimated Monthly Tax</td><td>${usd.format(state.estimatedTax)}</td></tr><tr><td>Take-Home After Tax</td><td>${usd.format(state.income - state.estimatedTax)}</td></tr><tr><td>Take-Home After Full Costs</td><td>${usd.format(state.netAfterCosts)}</td></tr></table>
      <ul><li>This tax estimate is directional and assumes a flat effective rate for planning speed.</li><li>Actual obligations may differ based on residency status, deductions, and treaty rules.</li></ul>
      <p class="why">Why it matters: many relocation plans fail because take-home is overestimated.</p>`
    ),
    section(
      "Runway & Safety Buffer",
      `<ul><li>Current runway: <strong>${formatRunway(state.runwayMonths)}</strong>.</li><li>Recommended emergency fund: <strong>${usd.format(emergencyFund)}</strong> (6 months of living cost).</li><li>${state.runwayMonths === Infinity ? "You are cash-flow positive, so runway is stable unless income changes." : `At your current burn, runway is finite and should be extended before relocating.`}</li></ul>
      <p class="why">Why it matters: runway buys time when income pauses, clients churn, or setup costs spike.</p>`
    ),
    section(
      "Visa Fit Check",
      `<table class="metric-table"><tr><td>Visa Income Requirement</td><td>${usd.format(state.city.visaIncomeRequirement)}</td></tr><tr><td>Your Income</td><td>${usd.format(state.income)}</td></tr><tr><td>Status</td><td>${state.visaPass ? "Pass" : "Fail"}</td></tr></table>
      <ul><li>${state.visaPass ? `You clear the threshold by ${usd.format(state.income - state.city.visaIncomeRequirement)}.` : `You are short by ${usd.format(state.city.visaIncomeRequirement - state.income)}.`}</li><li>${state.visaPass ? "This removes a major approval blocker." : "Without closing this gap, relocation timing is high risk."}</li></ul>
      <p class="why">Why it matters: even strong savings cannot always compensate for visa income shortfalls.</p>`
    ),
    section(
      "Risk & Stability",
      `<table class="metric-table"><tr><td>City Risk Level</td><td>${state.city.riskLevel}</td></tr><tr><td>Readiness Score</td><td>${state.score.total}/100</td></tr></table>
      <ul><li>Score inputs: affordability ${state.score.breakdown.margin}, runway ${state.score.breakdown.runway}, visa fit ${state.score.breakdown.visa}, city risk ${state.score.breakdown.risk}.</li><li>Weighted model: affordability 40%, runway 25%, visa 20%, risk 15%.</li></ul>
      <p class="why">Why it matters: this score reflects both today’s budget and your ability to absorb shocks.</p>`
    ),
    section(
      "Stress Test Scenarios",
      `<table class="metric-table"><tr><th>Scenario</th><th>Net After Costs</th><th>Runway</th></tr><tr><td>A: Income drops 20%</td><td>${usd.format(state.scenarioA.net)}</td><td>${formatRunway(state.scenarioA.runway)}</td></tr><tr><td>B: Rent increases 15%</td><td>${usd.format(state.scenarioB.net)}</td><td>${formatRunway(state.scenarioB.runway)}</td></tr><tr><td>C: Both together</td><td>${usd.format(state.worst.net)}</td><td>${formatRunway(state.worst.runway)}</td></tr></table>
      <ul><li>${state.worst.net < 0 ? `Worst-case flips you into a monthly deficit with survival runway of ${runwayDelta}.` : "Even worst-case remains positive, which is a strong resilience indicator."}</li></ul>
      <p class="why">Why it matters: stress tests reveal whether your plan survives real market volatility.</p>`
    ),
    section(
      "Best Moves Next",
      `<ul>${buildActionPlan(state).map((step) => `<li>${step}</li>`).join("")}</ul>
      <p class="why">Why it matters: focused moves in the next 30 days can materially improve approval odds and stability.</p>`
    ),
    section(
      "Cheaper Alternatives",
      `<table class="metric-table"><tr><th>City</th><th>Total Cost</th><th>Monthly Savings vs ${state.city.city}</th><th>Runway</th></tr>${cheaperRows}</table>
      <ul><li>These options are selected because they reduce total monthly cost at your same lifestyle level (${state.lifestyle}).</li></ul>
      <p class="why">Why it matters: shifting city can improve runway faster than cutting daily essentials.</p>`
    ),
    section(
      "Final Recommendation",
      `<p>Based on your current inputs, moving to ${state.city.city} is <strong>${state.verdict.label.toLowerCase()}</strong>. You can proceed if you lock in the action items above and avoid lifestyle drift during the first 90 days after relocation.</p>
      <ul><li>Protect your downside first, then optimize comfort.</li><li>Use your readiness score (${state.score.total}/100) as a checkpoint before booking.</li><li>If scenario C concerns you, delay and strengthen income/savings for one cycle.</li></ul>`
    )
  ].join("");
}

function bubble(role, content) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  div.innerHTML = content;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function replyFor(id, s) {
  const alt = s.alternatives;
  const biggest = [
    ["Rent", s.city.rent * s.multiplier],
    ["Food", s.city.food * s.multiplier],
    ["Transport", s.city.transport * s.multiplier],
    ["Insurance", s.city.insurance * s.multiplier],
    ["Coworking", s.city.coworking * s.multiplier]
  ].sort((a, b) => b[1] - a[1])[0];

  const comfortableIncome = (s.totalCost / (1 - s.city.taxRate)) + 800;

  const map = {
    verdict: `<strong>Your verdict is ${s.verdict.label}.</strong><ul><li>Net after costs: ${usd.format(s.netAfterCosts)}.</li><li>Runway: ${formatRunway(s.runwayMonths)}.</li><li>Score: ${s.score.total}/100.</li></ul>`,
    stress: `<strong>Stress test summary for ${s.city.city}:</strong><ul><li>A) Income -20% → ${usd.format(s.scenarioA.net)} net (${formatRunway(s.scenarioA.runway)} runway).</li><li>B) Rent +15% → ${usd.format(s.scenarioB.net)} net (${formatRunway(s.scenarioB.runway)} runway).</li><li>C) Both → ${usd.format(s.worst.net)} net (${formatRunway(s.worst.runway)} runway).</li></ul>`,
    next: `<strong>Next moves:</strong><ul>${buildActionPlan(s).slice(0, 3).map((a) => `<li>${a}</li>`).join("")}</ul>`,
    q1: `<ul><li>Your biggest expense in ${s.city.city} is <strong>${biggest[0]}</strong> at about ${usd.format(biggest[1])}/month.</li><li>It accounts for ${Math.round((biggest[1] / s.totalCost) * 100)}% of total living costs.</li></ul>`,
    q2: `<ul><li>To cut ${usd.format(300)} monthly, target rent reduction of ${usd.format(180)} and food reduction of ${usd.format(120)}.</li><li>If coworking is optional, dropping 2 days/week can save another ${usd.format((s.city.coworking * s.multiplier) * 0.35)}.</li></ul>`,
    q3: `<ul><li>Recommended rent target: <strong>${usd.format(s.city.rent * s.multiplier * 0.88)}</strong> max.</li><li>This keeps your projected monthly net closer to ${usd.format(s.netAfterCosts + s.city.rent * s.multiplier * 0.12)}.</li></ul>`,
    q4: `<ul><li>Coworking costs ${usd.format(s.city.coworking * s.multiplier)}/month in your model.</li><li>${s.netAfterCosts < 250 ? "Given your tight margin, start with hybrid cafés/home and add coworking later." : "Your current margin can absorb coworking, but keep it performance-driven."}</li></ul>`,
    q5: `<ul><li>Risk profile: <strong>${s.city.riskLevel}</strong> city risk with ${s.verdict.label} affordability.</li><li>Your readiness score is ${s.score.total}/100, mainly limited by ${s.score.breakdown.margin < 60 ? "monthly margin" : "stress-test resilience"}.</li></ul>`,
    q6: `<ul><li>If income drops 20%, your net shifts to ${usd.format(s.scenarioA.net)}.</li><li>${s.scenarioA.net < 0 ? `That creates burn; runway falls to ${formatRunway(s.scenarioA.runway)}.` : "You remain positive, but cushion narrows."}</li></ul>`,
    q7: `<ul><li>Worst-case (income -20% + rent +15%): ${usd.format(s.worst.net)} net.</li><li>Survival window: <strong>${formatRunway(s.worst.runway)}</strong>.</li></ul>`,
    q8: `<ul><li>Emergency fund target: ${usd.format(s.totalCost * 6)} (6 months).</li><li>Stretch goal: ${usd.format(s.totalCost * 9)} for high confidence.</li></ul>`,
    q9: `<ul><li>Visa threshold for ${s.city.city}: ${usd.format(s.city.visaIncomeRequirement)}.</li><li>Your income: ${usd.format(s.income)} → <strong>${s.visaPass ? "You meet it" : "You do not meet it"}</strong>.</li></ul>`,
    q10: `<ul><li>Workarounds if short: increase verified contract income, add a retained client, or delay until trailing 3-month average clears requirement.</li><li>Current gap: ${usd.format(Math.max(0, s.city.visaIncomeRequirement - s.income))}.</li></ul>`,
    q11: `<ul><li>Prepare first: passport validity, proof of income, bank statements, health insurance, rental plan, tax ID docs.</li><li>Keep digital + notarized copies to speed approval windows.</li></ul>`,
    q12: `<ul><li>Common mistakes in ${s.city.city}: underestimating taxes, overpaying first rental contract, and relocating with <4 months runway.</li><li>Your current runway is ${formatRunway(s.runwayMonths)}.</li></ul>`,
    q13: `<ul><li>Better budget-fit cities: ${alt[0] ? `${alt[0].city.city} (save ${usd.format(alt[0].monthlyDiff)}/mo)` : "none"}${alt[1] ? `, ${alt[1].city.city} (save ${usd.format(alt[1].monthlyDiff)}/mo)` : ""}.</li><li>These improve runway without changing your lifestyle level.</li></ul>`,
    q14: `<ul><li>${s.verdict.label === "Sustainable" ? "You can move now" : "Waiting 6 months is safer"} based on your margin of ${usd.format(s.netAfterCosts)}.</li><li>Use delay time to reach ${usd.format(s.totalCost * 6)} savings floor.</li></ul>`,
    q15: `<ul><li>Comfortable target income for ${s.city.city}: about <strong>${usd.format(comfortableIncome)}</strong>/month.</li><li>This assumes current lifestyle costs plus a ${usd.format(800)} surplus buffer.</li></ul>`,
    q16: `<ul><li>Week 1: lock rent target and visa document checklist.</li><li>Week 2: optimize cost plan to protect ${usd.format(300)}+ monthly buffer.</li><li>Week 3: validate tax/insurance details and move logistics.</li><li>Week 4: final go/no-go using stress scenario C and runway.</li></ul>`
  };

  return map[id] || "I can answer that after generating your report.";
}

function addQuestionButton(container, key, label, className = "question-btn") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener("click", () => {
    bubble("user", label);
    bubble("ai", replyFor(key, latest));
  });
  container.appendChild(btn);
}

function initChat(state) {
  chatPanel.hidden = false;
  chatMessages.innerHTML = "";
  chatQuestions.innerHTML = "";
  quickActions.innerHTML = "";

  bubble("ai", `I analyzed your move to <strong>${state.city.city}</strong>. Ask me anything from the buttons below, and I'll use your real numbers instantly.`);

  addQuestionButton(quickActions, "verdict", "Explain my verdict", "quick-btn");
  addQuestionButton(quickActions, "stress", "Show my stress test", "quick-btn");
  addQuestionButton(quickActions, "next", "Give me next steps", "quick-btn");

  const categories = [
    ["CATEGORY 1: Budget & Costs", [["q1", "What’s my biggest expense in this city?"], ["q2", "How can I lower my monthly cost by $300?"], ["q3", "What rent budget should I target?"], ["q4", "Is coworking necessary for my profile?"]]],
    ["CATEGORY 2: Safety & Risk", [["q5", "How risky is this move for me?"], ["q6", "What happens if my income drops?"], ["q7", "How many months can I survive worst-case?"], ["q8", "What emergency fund should I build?"]]],
    ["CATEGORY 3: Visa & Practical", [["q9", "Do I meet the visa income requirement?"], ["q10", "If I don’t meet it, what’s the workaround?"], ["q11", "What documents should I prepare first?"], ["q12", "What are common relocation mistakes here?"]]],
    ["CATEGORY 4: Alternatives & Strategy", [["q13", "What are 2 better cities for my budget?"], ["q14", "Should I move now or wait 6 months?"], ["q15", "What income should I aim for to be comfortable here?"], ["q16", "Give me a 30-day action plan."]]]
  ];

  categories.forEach(([title, q]) => {
    const heading = document.createElement("p");
    heading.style.width = "100%";
    heading.style.margin = "0.25rem 0";
    heading.style.color = "#93c5fd";
    heading.style.fontWeight = "600";
    heading.textContent = title;
    chatQuestions.appendChild(heading);
    q.forEach(([key, label]) => addQuestionButton(chatQuestions, key, label));
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const income = Number(document.getElementById("income").value);
  const savings = Number(document.getElementById("savings").value);
  const city = cityData.find((c) => c.city === citySelect.value);
  const lifestyle = document.getElementById("lifestyle").value;

  if (!city || Number.isNaN(income) || Number.isNaN(savings)) return;

  outputGrid.hidden = false;
  loadingState.hidden = false;
  reportRoot.innerHTML = "";
  resultIntro.textContent = "";
  chatPanel.hidden = true;

  window.setTimeout(() => {
    const multiplier = lifestyleMultipliers[lifestyle];
    const baseTotal = city.rent + city.food + city.transport + city.insurance + city.coworking;
    const totalCost = baseTotal * multiplier;
    const estimatedTax = income * city.taxRate;
    const netAfterCosts = income - (totalCost + estimatedTax);
    const runwayMonths = computeRunway(savings, netAfterCosts);

    const scenarioA = getScenario(income * 0.8, totalCost, city.taxRate, savings);
    const scenarioB = getScenario(income, totalCost + city.rent * multiplier * 0.15, city.taxRate, savings);
    const worst = getScenario(income * 0.8, totalCost + city.rent * multiplier * 0.15, city.taxRate, savings);

    const visaPass = income >= city.visaIncomeRequirement;
    const verdict = getVerdict(netAfterCosts);
    const alternatives = getCheaperAlternatives(city, multiplier, totalCost, income, savings, city.taxRate);

    latest = {
      income,
      savings,
      city,
      lifestyle,
      multiplier,
      baseTotal,
      totalCost,
      estimatedTax,
      netAfterCosts,
      runwayMonths,
      scenarioA,
      scenarioB,
      worst,
      visaPass,
      verdict,
      alternatives
    };

    latest.score = scoreReadiness(latest);

    verdictBadge.className = `status-badge ${verdict.className}`;
    verdictBadge.textContent = `${verdict.label} · Score ${latest.score.total}/100`;

    resultIntro.textContent = `You entered ${usd.format(income)} monthly income and ${usd.format(savings)} savings for a ${lifestyle.toLowerCase()} lifestyle in ${city.city}. Here's your full AI relocation analysis.`;
    reportRoot.innerHTML = buildReport(latest);

    initChat(latest);
    loadingState.hidden = true;
    document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
  }, 950);
});
