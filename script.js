const cityData = [
  { city: "Bangkok", country: "Thailand", rent: 700, food: 320, transport: 90, insurance: 120, coworking: 160, taxRate: 0.1, visaIncomeRequirement: 2000, riskLevel: "Medium" },
  { city: "Chiang Mai", country: "Thailand", rent: 520, food: 260, transport: 70, insurance: 110, coworking: 130, taxRate: 0.1, visaIncomeRequirement: 1800, riskLevel: "Low" },
  { city: "Phuket", country: "Thailand", rent: 780, food: 340, transport: 95, insurance: 120, coworking: 170, taxRate: 0.1, visaIncomeRequirement: 2200, riskLevel: "Medium" },
  { city: "Lisbon", country: "Portugal", rent: 1250, food: 420, transport: 75, insurance: 160, coworking: 190, taxRate: 0.22, visaIncomeRequirement: 2800, riskLevel: "Low" },
  { city: "Porto", country: "Portugal", rent: 980, food: 360, transport: 70, insurance: 150, coworking: 170, taxRate: 0.21, visaIncomeRequirement: 2400, riskLevel: "Low" },
  { city: "Berlin", country: "Germany", rent: 1400, food: 430, transport: 95, insurance: 220, coworking: 210, taxRate: 0.27, visaIncomeRequirement: 3200, riskLevel: "Low" },
  { city: "Munich", country: "Germany", rent: 1850, food: 470, transport: 95, insurance: 230, coworking: 220, taxRate: 0.29, visaIncomeRequirement: 3600, riskLevel: "Low" },
  { city: "Hamburg", country: "Germany", rent: 1500, food: 420, transport: 90, insurance: 220, coworking: 200, taxRate: 0.27, visaIncomeRequirement: 3300, riskLevel: "Low" },
  { city: "Amsterdam", country: "Netherlands", rent: 1900, food: 510, transport: 115, insurance: 210, coworking: 240, taxRate: 0.31, visaIncomeRequirement: 3800, riskLevel: "Low" },
  { city: "Rotterdam", country: "Netherlands", rent: 1450, food: 460, transport: 105, insurance: 205, coworking: 210, taxRate: 0.29, visaIncomeRequirement: 3400, riskLevel: "Low" },
  { city: "Paris", country: "France", rent: 2050, food: 520, transport: 95, insurance: 230, coworking: 260, taxRate: 0.31, visaIncomeRequirement: 3900, riskLevel: "Medium" },
  { city: "Lyon", country: "France", rent: 1380, food: 430, transport: 80, insurance: 210, coworking: 200, taxRate: 0.28, visaIncomeRequirement: 3100, riskLevel: "Low" },
  { city: "Toronto", country: "Canada", rent: 2050, food: 540, transport: 120, insurance: 240, coworking: 250, taxRate: 0.3, visaIncomeRequirement: 4200, riskLevel: "Low" },
  { city: "Vancouver", country: "Canada", rent: 2200, food: 560, transport: 125, insurance: 240, coworking: 260, taxRate: 0.31, visaIncomeRequirement: 4300, riskLevel: "Low" },
  { city: "Montreal", country: "Canada", rent: 1450, food: 460, transport: 95, insurance: 220, coworking: 220, taxRate: 0.27, visaIncomeRequirement: 3400, riskLevel: "Low" },
  { city: "Sydney", country: "Australia", rent: 2200, food: 590, transport: 130, insurance: 250, coworking: 270, taxRate: 0.32, visaIncomeRequirement: 4600, riskLevel: "Low" },
  { city: "Melbourne", country: "Australia", rent: 1950, food: 550, transport: 125, insurance: 245, coworking: 250, taxRate: 0.31, visaIncomeRequirement: 4300, riskLevel: "Low" },
  { city: "New York", country: "USA", rent: 2900, food: 680, transport: 135, insurance: 360, coworking: 320, taxRate: 0.33, visaIncomeRequirement: 5200, riskLevel: "Medium" },
  { city: "Miami", country: "USA", rent: 2300, food: 610, transport: 140, insurance: 340, coworking: 280, taxRate: 0.28, visaIncomeRequirement: 4500, riskLevel: "Medium" },
  { city: "Austin", country: "USA", rent: 1900, food: 560, transport: 120, insurance: 330, coworking: 250, taxRate: 0.27, visaIncomeRequirement: 4200, riskLevel: "Low" },
  { city: "Los Angeles", country: "USA", rent: 2700, food: 650, transport: 145, insurance: 350, coworking: 300, taxRate: 0.32, visaIncomeRequirement: 5000, riskLevel: "Medium" }
];

const lifestyleMultipliers = {
  Basic: 0.9,
  Standard: 1,
  Comfortable: 1.2
};

const citySelect = document.getElementById("city");
const form = document.getElementById("calculator-form");
const monthlyCostNode = document.getElementById("monthly-cost");
const verdictBadge = document.getElementById("verdict-badge");
const resultText = document.getElementById("result-text");

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const cityOptions = cityData
  .sort((a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city))
  .map((entry) => `<option value="${entry.city}">${entry.city}, ${entry.country}</option>`)
  .join("");

citySelect.innerHTML = cityOptions;

function getVerdict(income, threshold) {
  const lower = threshold * 0.9;
  const upper = threshold * 1.1;

  if (income > upper) {
    return { label: "Sustainable", className: "sustainable" };
  }

  if (income >= lower && income <= upper) {
    return { label: "Tight", className: "tight" };
  }

  return { label: "Not Realistic", className: "not-realistic" };
}

function getAlternativeCity(totalCost, currentCity) {
  const cheaper = cityData
    .filter((city) => city.city !== currentCity.city)
    .map((city) => {
      const baseCost = city.rent + city.food + city.transport + city.insurance + city.coworking;
      return { name: `${city.city}, ${city.country}`, cost: baseCost };
    })
    .filter((city) => city.cost < totalCost)
    .sort((a, b) => a.cost - b.cost);

  return cheaper[0] ? `${cheaper[0].name} (${usd.format(cheaper[0].cost)}/mo base)` : "No cheaper city available in current dataset";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const income = Number(document.getElementById("income").value);
  const savings = Number(document.getElementById("savings").value);
  const selectedCity = cityData.find((city) => city.city === citySelect.value);
  const lifestyle = document.getElementById("lifestyle").value;

  if (!selectedCity || Number.isNaN(income) || Number.isNaN(savings)) {
    return;
  }

  const baseCost = selectedCity.rent + selectedCity.food + selectedCity.transport + selectedCity.insurance + selectedCity.coworking;
  const totalCost = baseCost * lifestyleMultipliers[lifestyle];
  const taxEstimate = income * selectedCity.taxRate;
  const requiredMonthly = totalCost + taxEstimate;

  const verdict = getVerdict(income, requiredMonthly);

  let runway = "Stable";
  if (income < totalCost) {
    const burnRate = totalCost - income;
    runway = burnRate > 0 ? `${(savings / burnRate).toFixed(1)} months` : "Stable";
  }

  const visaStatus = income >= selectedCity.visaIncomeRequirement ? "meets" : "is below";
  const explanation = `In ${selectedCity.city}, your estimated monthly cost is ${usd.format(totalCost)} and estimated tax is ${usd.format(taxEstimate)}. This profile is ${verdict.label.toLowerCase()}. Your savings runway is ${runway}. Your income ${visaStatus} the visa income reference (${usd.format(selectedCity.visaIncomeRequirement)}), and risk level is ${selectedCity.riskLevel}. Alternative cheaper city: ${getAlternativeCity(totalCost, selectedCity)}.`;

  monthlyCostNode.textContent = usd.format(totalCost);
  verdictBadge.textContent = verdict.label;
  verdictBadge.className = `badge ${verdict.className}`;
  resultText.textContent = explanation;
});
