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

const citySelect = document.getElementById("city");
const form = document.getElementById("calculator-form");
const verdictBadge = document.getElementById("verdict-badge");
const reportRoot = document.getElementById("report-root");
const loadingState = document.getElementById("loading-state");
const resultIntro = document.getElementById("result-intro");
const resultsSection = document.getElementById("results");

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

citySelect.innerHTML = cityData
  .sort((a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city))
  .map((entry) => `<option value="${entry.city}">${entry.city}, ${entry.country}</option>`)
  .join("");

function getVerdictClass(netSurplus) {
  if (netSurplus >= 1200) return { label: "Strongly Viable", className: "positive" };
  if (netSurplus >= 250) return { label: "Viable with Guardrails", className: "warning" };
  return { label: "High Financial Risk", className: "negative" };
}

function dynamicTone(income, netSurplus, visaPass, runwayMonths) {
  const runwayStatus = runwayMonths >= 9 ? "resilient" : runwayMonths >= 4 ? "sensitive" : "fragile";

  if (netSurplus > 1000 && visaPass) {
    return `With your current income of ${usd.format(income)}, this move profile looks financially confident and ${runwayStatus}.`;
  }
  if (netSurplus > 0 && visaPass) {
    return `With your current income of ${usd.format(income)}, you can make this move work, but your monthly buffer remains ${runwayStatus}.`;
  }
  return `With your current income of ${usd.format(income)}, this relocation setup is currently strained and needs optimization before committing.`;
}

function getAlternativeCity(currentCityName, lifestyleMultiplier, currentMonthlyCost) {
  const ranked = cityData
    .filter((city) => city.city !== currentCityName)
    .map((city) => {
      const base = city.rent + city.food + city.transport + city.insurance + city.coworking;
      const modeled = base * lifestyleMultiplier;
      return {
        name: `${city.city}, ${city.country}`,
        modeled
      };
    })
    .filter((city) => city.modeled < currentMonthlyCost)
    .sort((a, b) => a.modeled - b.modeled);

  return ranked[0] || null;
}

function sectionTemplate(title, icon, body, open = false) {
  return `
    <details class="report-section" ${open ? "open" : ""}>
      <summary><span>${icon} ${title}</span><span>+</span></summary>
      <div class="section-content">${body}</div>
    </details>
  `;
}

function buildReport(data) {
  const {
    income,
    savings,
    city,
    totalMonthlyCost,
    taxEstimate,
    netSurplus,
    runwayMonths,
    verdict,
    visaGap,
    visaPass,
    stressIncomeDrop,
    stressRentIncrease,
    alternative,
    introTone
  } = data;

  const financialOverview = sectionTemplate(
    "SECTION 1 — Financial Overview",
    "📊",
    `
      <table class="metric-table">
        <tr><td>Monthly Cost Breakdown</td><td>${usd.format(totalMonthlyCost)}</td></tr>
        <tr><td>Estimated Tax</td><td>${usd.format(taxEstimate)}</td></tr>
        <tr><td>Net Surplus / Deficit</td><td>${usd.format(netSurplus)}</td></tr>
        <tr><td>Savings Runway</td><td>${runwayMonths === Infinity ? "Stable (no monthly burn)" : `${runwayMonths.toFixed(1)} months`}</td></tr>
      </table>
      <p>${introTone} Given your savings of ${usd.format(savings)}, your runway profile currently looks ${runwayMonths >= 9 ? "well-cushioned" : runwayMonths >= 4 ? "moderately protected" : "thin"}.</p>
    `,
    true
  );

  const affordability = sectionTemplate(
    "SECTION 2 — Affordability Assessment",
    "🧭",
    `
      <p><strong>Verdict:</strong> ${verdict.label}</p>
      <ul>
        <li>Your modeled lifestyle-adjusted spend in ${city.city} is ${usd.format(totalMonthlyCost)} per month.</li>
        <li>Your post-tax monthly cash position is ${usd.format(netSurplus)}.</li>
        <li>${netSurplus > 0 ? "You are cash-flow positive, but should protect margin for volatility." : "You are cash-flow negative and will draw from savings each month."}</li>
      </ul>
      <p><strong>Risk factors:</strong> ${city.riskLevel} city risk, ${netSurplus < 250 ? "tight affordability buffer" : "manageable budget pressure"}, and lifestyle sensitivity.</p>
    `
  );

  const visa = sectionTemplate(
    "SECTION 3 — Visa Compatibility",
    "🛂",
    `
      <table class="metric-table">
        <tr><td>Required Income</td><td>${usd.format(city.visaIncomeRequirement)}</td></tr>
        <tr><td>Your Income</td><td>${usd.format(income)}</td></tr>
        <tr><td>Status</td><td>${visaPass ? "Pass ✅" : "Fail ❌"}</td></tr>
      </table>
      <p>${visaPass ? `You exceed the threshold by ${usd.format(visaGap)} and are aligned with baseline visa income requirements.` : `You are below the threshold by ${usd.format(Math.abs(visaGap))}, so visa eligibility may be blocked without income uplift.`}</p>
    `
  );

  const risk = sectionTemplate(
    "SECTION 4 — Risk & Stability Score",
    "⚠️",
    `
      <p><strong>Risk level:</strong> ${netSurplus >= 1000 && visaPass ? "Low" : netSurplus >= 200 && visaPass ? "Medium" : "High"}</p>
      <ul>
        <li>Base profile: ${city.riskLevel} regional risk with ${netSurplus >= 0 ? "positive" : "negative"} monthly cash flow.</li>
        <li>Scenario simulation — if income drops 20%: projected net becomes ${usd.format(stressIncomeDrop)}.</li>
        <li>Scenario simulation — if rent increases 15%: projected net becomes ${usd.format(stressRentIncrease)}.</li>
      </ul>
    `
  );

  const alternativeText = alternative
    ? `
      <p>MoveMeter suggests <strong>${alternative.name}</strong> as a lower-cost alternative.</p>
      <table class="metric-table">
        <tr><td>Current City Modeled Cost</td><td>${usd.format(totalMonthlyCost)}</td></tr>
        <tr><td>Alternative Modeled Cost</td><td>${usd.format(alternative.modeled)}</td></tr>
        <tr><td>Estimated Monthly Savings Delta</td><td>${usd.format(totalMonthlyCost - alternative.modeled)}</td></tr>
      </table>
      <p>This option improves affordability resilience while preserving a similar remote-work lifestyle profile.</p>
    `
    : "<p>No lower-cost city was found in the current dataset for your selected lifestyle profile.</p>";

  const alternatives = sectionTemplate(
    "SECTION 5 — Smarter Alternative",
    "💡",
    alternativeText
  );

  return `${financialOverview}${affordability}${visa}${risk}${alternatives}`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const income = Number(document.getElementById("income").value);
  const savings = Number(document.getElementById("savings").value);
  const city = cityData.find((item) => item.city === citySelect.value);
  const lifestyle = document.getElementById("lifestyle").value;

  if (!city || Number.isNaN(income) || Number.isNaN(savings)) return;

  loadingState.hidden = false;
  reportRoot.innerHTML = "";
  resultIntro.textContent = "";

  window.setTimeout(() => {
    const lifestyleMultiplier = lifestyleMultipliers[lifestyle];
    const baseMonthlyCost = city.rent + city.food + city.transport + city.insurance + city.coworking;
    const totalMonthlyCost = baseMonthlyCost * lifestyleMultiplier;
    const taxEstimate = income * city.taxRate;
    const netSurplus = income - totalMonthlyCost - taxEstimate;
    const burnRate = Math.max(0, totalMonthlyCost + taxEstimate - income);
    const runwayMonths = burnRate === 0 ? Infinity : savings / burnRate;
    const verdict = getVerdictClass(netSurplus);
    const visaGap = income - city.visaIncomeRequirement;
    const visaPass = visaGap >= 0;
    const stressIncomeDrop = income * 0.8 - totalMonthlyCost - income * 0.8 * city.taxRate;
    const stressRentIncrease = income - (totalMonthlyCost + city.rent * lifestyleMultiplier * 0.15) - taxEstimate;
    const alternative = getAlternativeCity(city.city, lifestyleMultiplier, totalMonthlyCost);
    const introTone = dynamicTone(income, netSurplus, visaPass, runwayMonths);

    verdictBadge.textContent = verdict.label;
    verdictBadge.className = `badge ${verdict.className} verdict-reveal`;

    resultIntro.textContent = introTone;
    reportRoot.innerHTML = buildReport({
      income,
      savings,
      city,
      totalMonthlyCost,
      taxEstimate,
      netSurplus,
      runwayMonths,
      verdict,
      visaGap,
      visaPass,
      stressIncomeDrop,
      stressRentIncrease,
      alternative,
      introTone
    });

    loadingState.hidden = true;
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 950);
});
