let people = ["わたし", "相手"];

let expenses = [
  {
    title: "特急券",
    amount: 7200,
    payer: "わたし",
    memo: "2人分"
  },
  {
    title: "ランチ",
    amount: 3600,
    payer: "相手",
    memo: "旅行初日"
  }
];

let editIndex = null;

const STORAGE_KEY = "travel_split_data_v1";

const personInput = document.getElementById("personInput");
const addPersonBtn = document.getElementById("addPersonBtn");
const peopleList = document.getElementById("peopleList");

const expenseTitle = document.getElementById("expenseTitle");
const expenseAmount = document.getElementById("expenseAmount");
const payerSelect = document.getElementById("payerSelect");
const expenseMemo = document.getElementById("expenseMemo");

const saveExpenseBtn = document.getElementById("saveExpenseBtn");
const clearFormBtn = document.getElementById("clearFormBtn");

const expenseList = document.getElementById("expenseList");
const settlementList = document.getElementById("settlementList");
const balanceList = document.getElementById("balanceList");

const totalAmount = document.getElementById("totalAmount");
const perPerson = document.getElementById("perPerson");
const formTitle = document.getElementById("formTitle");
const copyBtn = document.getElementById("copyBtn");

function yen(value){
  return "¥" + Math.round(value).toLocaleString();
}

function saveData(){
  const data = {
    people,
    expenses
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadData(){
  const saved = localStorage.getItem(STORAGE_KEY);
  if(!saved) return;

  try{
    const data = JSON.parse(saved);
    if(Array.isArray(data.people)) people = data.people;
    if(Array.isArray(data.expenses)) expenses = data.expenses;
  }catch(e){
    console.warn("保存データの読み込みに失敗しました", e);
  }
}

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, function(s){
    return {
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[s];
  });
}

function render(){
  renderPeople();
  renderPayerOptions();
  renderExpenses();
  renderSummary();
  renderSettlement();
}

function renderPeople(){
  peopleList.innerHTML = people.map(function(person, index){
    const deleteButton = people.length > 2
      ? `<button type="button" onclick="removePerson(${index})">×</button>`
      : "";

    return `
      <span class="chip">
        ${escapeHtml(person)}
        ${deleteButton}
      </span>
    `;
  }).join("");
}

function renderPayerOptions(){
  const current = payerSelect.value;

  payerSelect.innerHTML = people.map(function(person){
    return `<option value="${escapeHtml(person)}">${escapeHtml(person)}</option>`;
  }).join("");

  if(people.includes(current)){
    payerSelect.value = current;
  }
}

function renderExpenses(){
  if(expenses.length === 0){
    expenseList.innerHTML = `<div class="empty">まだ支払いがありません。</div>`;
    return;
  }

  expenseList.innerHTML = expenses.map(function(expense, index){
    return `
      <article class="expense">
        <div class="expenseTop">
          <div>
            <h3>${escapeHtml(expense.title)}</h3>
            <div class="expenseMeta">
              支払い：${escapeHtml(expense.payer)}
              ${expense.memo ? " / " + escapeHtml(expense.memo) : ""}
            </div>
          </div>
          <div class="expenseAmount">${yen(expense.amount)}</div>
        </div>

        <div class="expenseBtns">
          <button class="miniBtn" type="button" onclick="editExpense(${index})">編集</button>
          <button class="miniBtn danger" type="button" onclick="deleteExpense(${index})">削除</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderSummary(){
  const total = expenses.reduce(function(sum, expense){
    return sum + Number(expense.amount || 0);
  }, 0);

  totalAmount.textContent = yen(total);
  perPerson.textContent = people.length ? yen(total / people.length) : "¥0";
}

function getBalances(){
  const total = expenses.reduce(function(sum, expense){
    return sum + Number(expense.amount || 0);
  }, 0);

  const share = people.length ? total / people.length : 0;

  const paidMap = {};
  people.forEach(function(person){
    paidMap[person] = 0;
  });

  expenses.forEach(function(expense){
    if(paidMap[expense.payer] !== undefined){
      paidMap[expense.payer] += Number(expense.amount || 0);
    }
  });

  return people.map(function(person){
    return {
      name: person,
      paid: paidMap[person],
      balance: paidMap[person] - share
    };
  });
}

function renderSettlement(){
  const balances = getBalances();

  balanceList.innerHTML = balances.map(function(item){
    const className = item.balance >= 0 ? "plus" : "minus";
    const sign = item.balance >= 0 ? "+" : "";

    return `
      <div class="balance ${className}">
        <span>${escapeHtml(item.name)}：支払い ${yen(item.paid)}</span>
        <b>${sign}${yen(item.balance)}</b>
      </div>
    `;
  }).join("");

  const creditors = balances
    .filter(function(item){ return item.balance > 0.5; })
    .map(function(item){ return {...item}; });

  const debtors = balances
    .filter(function(item){ return item.balance < -0.5; })
    .map(function(item){ return {...item, balance: -item.balance}; });

  const results = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while(debtorIndex < debtors.length && creditorIndex < creditors.length){
    const amount = Math.min(
      debtors[debtorIndex].balance,
      creditors[creditorIndex].balance
    );

    results.push({
      from: debtors[debtorIndex].name,
      to: creditors[creditorIndex].name,
      amount
    });

    debtors[debtorIndex].balance -= amount;
    creditors[creditorIndex].balance -= amount;

    if(debtors[debtorIndex].balance <= 0.5) debtorIndex++;
    if(creditors[creditorIndex].balance <= 0.5) creditorIndex++;
  }

  if(results.length === 0){
    settlementList.innerHTML = `<div class="empty">精算はありません。</div>`;
    return;
  }

  settlementList.innerHTML = results.map(function(result){
    return `
      <div class="result">
        <strong>${escapeHtml(result.from)} → ${escapeHtml(result.to)}</strong>
        <b>${yen(result.amount)}</b>
      </div>
    `;
  }).join("");
}

function addPerson(){
  const name = personInput.value.trim();

  if(!name) return;

  if(people.includes(name)){
    alert("同じ名前がすでにあります");
    return;
  }

  people.push(name);
  personInput.value = "";

  saveData();
  render();
}

function removePerson(index){
  const name = people[index];

  const hasExpense = expenses.some(function(expense){
    return expense.payer === name;
  });

  if(hasExpense){
    alert("この人の支払い記録があります。先に編集または削除してください。");
    return;
  }

  people.splice(index, 1);

  saveData();
  render();
}

function saveExpense(){
  const title = expenseTitle.value.trim();
  const amount = Number(expenseAmount.value);
  const payer = payerSelect.value;
  const memo = expenseMemo.value.trim();

  if(!title){
    alert("内容を入力してください");
    return;
  }

  if(!amount || amount <= 0){
    alert("金額を入力してください");
    return;
  }

  const item = {
    title,
    amount,
    payer,
    memo
  };

  if(editIndex === null){
    expenses.push(item);
  }else{
    expenses[editIndex] = item;
  }

  clearForm();
  saveData();
  render();
}

function editExpense(index){
  const item = expenses[index];

  editIndex = index;
  formTitle.textContent = "支払いを編集";
  saveExpenseBtn.textContent = "更新する";

  expenseTitle.value = item.title;
  expenseAmount.value = item.amount;
  payerSelect.value = item.payer;
  expenseMemo.value = item.memo || "";

  expenseTitle.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function deleteExpense(index){
  if(!confirm("この支払いを削除しますか？")) return;

  expenses.splice(index, 1);

  clearForm();
  saveData();
  render();
}

function clearForm(){
  editIndex = null;

  formTitle.textContent = "支払いを追加";
  saveExpenseBtn.textContent = "追加する";

  expenseTitle.value = "";
  expenseAmount.value = "";
  expenseMemo.value = "";
}

function copyResult(){
  const total = expenses.reduce(function(sum, expense){
    return sum + Number(expense.amount || 0);
  }, 0);

  const results = Array.from(document.querySelectorAll(".result"))
    .map(function(el){ return el.innerText; })
    .join("\\n");

  const text = [
    "旅行費用サマリ",
    "合計：" + yen(total),
    "1人あたり：" + yen(total / people.length),
    "",
    "最終精算",
    results || "精算なし"
  ].join("\\n");

  navigator.clipboard.writeText(text).then(function(){
    alert("結果をコピーしました");
  }).catch(function(){
    alert(text);
  });
}

addPersonBtn.addEventListener("click", addPerson);
saveExpenseBtn.addEventListener("click", saveExpense);
clearFormBtn.addEventListener("click", clearForm);
copyBtn.addEventListener("click", copyResult);

loadData();
render();