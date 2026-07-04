// AUTO-GENERATED from Chart_of_Accounts-NITAQ.xlsx — account codes/names preserved exactly (whitespace normalised).
export interface SeedAccount {
  code: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  isPosting: boolean;
  parentCode: string | null;
  category: string;
  subCategory: string | null;
  mainAccount: string | null;
}

export const COA_SEED: SeedAccount[] = [
  {
    "code": "1",
    "name": "ASSETS",
    "type": "Asset",
    "isPosting": false,
    "parentCode": null,
    "category": "ASSETS",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "101",
    "name": "CURRENT ASSETS",
    "type": "Asset",
    "isPosting": false,
    "parentCode": "1",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": null
  },
  {
    "code": "10101",
    "name": "CASH",
    "type": "Asset",
    "isPosting": false,
    "parentCode": "101",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": null
  },
  {
    "code": "1010100001",
    "name": "Cash In hand",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10101",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "CASH"
  },
  {
    "code": "1010100002",
    "name": "RAK-POS collection",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10101",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "CASH"
  },
  {
    "code": "1010100003",
    "name": "Tabby collection",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10101",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "CASH"
  },
  {
    "code": "1010100004",
    "name": "Tamara collection",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10101",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "CASH"
  },
  {
    "code": "1010100005",
    "name": "Petty Cash",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10101",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "CASH"
  },
  {
    "code": "1010100006",
    "name": "Petty Cash- Muzammil",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10101",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "CASH"
  },
  {
    "code": "1010100007",
    "name": "Petty Cash- Abdelrahman",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10101",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "CASH"
  },
  {
    "code": "10102",
    "name": "BANKS",
    "type": "Asset",
    "isPosting": false,
    "parentCode": "101",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": null
  },
  {
    "code": "1010200001",
    "name": "RAK Bank",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10102",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "BANKS"
  },
  {
    "code": "10103",
    "name": "ACCOUNTS RECEIVABLES",
    "type": "Asset",
    "isPosting": false,
    "parentCode": "101",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": null
  },
  {
    "code": "1010300001",
    "name": "Student-1",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10103",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "ACCOUNTS RECEIVABLES"
  },
  {
    "code": "1010400001",
    "name": "Security Deposits",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10103",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "ACCOUNTS RECEIVABLES"
  },
  {
    "code": "10105",
    "name": "Employee Advances",
    "type": "Asset",
    "isPosting": false,
    "parentCode": "101",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": null
  },
  {
    "code": "1010500001",
    "name": "Employee 1",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10105",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "Employee Advances"
  },
  {
    "code": "1010600001",
    "name": "Cheques Receivable",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10105",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "Employee Advances"
  },
  {
    "code": "10107",
    "name": "Prepaid Expenses",
    "type": "Asset",
    "isPosting": false,
    "parentCode": "101",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": null
  },
  {
    "code": "1010700001",
    "name": "Prepaid Rent / Landlease",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10107",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "Prepaid Expenses"
  },
  {
    "code": "1010700002",
    "name": "Prepaid Trade License",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10107",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "Prepaid Expenses"
  },
  {
    "code": "1010700003",
    "name": "Prepaid Medical Insurance",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10107",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "Prepaid Expenses"
  },
  {
    "code": "1010700004",
    "name": "Prepaid- Clinic & Doctor License",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "10107",
    "category": "ASSETS",
    "subCategory": "CURRENT ASSETS",
    "mainAccount": "Prepaid Expenses"
  },
  {
    "code": "102",
    "name": "FIXED ASSET",
    "type": "Asset",
    "isPosting": false,
    "parentCode": "1",
    "category": "ASSETS",
    "subCategory": "FIXED ASSET",
    "mainAccount": null
  },
  {
    "code": "10202001",
    "name": "Leasehold Land",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "102",
    "category": "ASSETS",
    "subCategory": "FIXED ASSET",
    "mainAccount": null
  },
  {
    "code": "10202002",
    "name": "Furniture & Fixtures",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "102",
    "category": "ASSETS",
    "subCategory": "FIXED ASSET",
    "mainAccount": null
  },
  {
    "code": "10202003",
    "name": "Sports Equipment",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "102",
    "category": "ASSETS",
    "subCategory": "FIXED ASSET",
    "mainAccount": null
  },
  {
    "code": "10202004",
    "name": "School Equipment",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "102",
    "category": "ASSETS",
    "subCategory": "FIXED ASSET",
    "mainAccount": null
  },
  {
    "code": "10202005",
    "name": "Building - Cost",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "102",
    "category": "ASSETS",
    "subCategory": "FIXED ASSET",
    "mainAccount": null
  },
  {
    "code": "10202006",
    "name": "Laptop And Computers",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "102",
    "category": "ASSETS",
    "subCategory": "FIXED ASSET",
    "mainAccount": null
  },
  {
    "code": "10202007",
    "name": "Assets - Computer & Accessories",
    "type": "Asset",
    "isPosting": true,
    "parentCode": "102",
    "category": "ASSETS",
    "subCategory": "FIXED ASSET",
    "mainAccount": null
  },
  {
    "code": "2",
    "name": "LIABILITIES",
    "type": "Liability",
    "isPosting": false,
    "parentCode": null,
    "category": "LIABILITIES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "201",
    "name": "CURRENT LIABILITY",
    "type": "Liability",
    "isPosting": false,
    "parentCode": "2",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": null
  },
  {
    "code": "2010100001",
    "name": "Accrued Salary Payable",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": null
  },
  {
    "code": "2010100002",
    "name": "Cheques Payable",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": null
  },
  {
    "code": "20102",
    "name": "Accounts Payable",
    "type": "Liability",
    "isPosting": false,
    "parentCode": "201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": null
  },
  {
    "code": "SP001",
    "name": "Etisalat",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20102",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Accounts Payable"
  },
  {
    "code": "SP002",
    "name": "DEWA",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20102",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Accounts Payable"
  },
  {
    "code": "SP003",
    "name": "Abu Khamseen Towers",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20102",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Accounts Payable"
  },
  {
    "code": "20201",
    "name": "Related Party",
    "type": "Liability",
    "isPosting": false,
    "parentCode": "201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": null
  },
  {
    "code": "2020100001",
    "name": "Dantella Saloon",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Related Party"
  },
  {
    "code": "2020100002",
    "name": "Kids are Kids Nursery",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Related Party"
  },
  {
    "code": "2030100001",
    "name": "Fees Advance",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Related Party"
  },
  {
    "code": "2030100002",
    "name": "Input VAT",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Related Party"
  },
  {
    "code": "2030100003",
    "name": "Output VAT",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Related Party"
  },
  {
    "code": "20121",
    "name": "Accumulated Dep - Furniture & Fixture",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Related Party"
  },
  {
    "code": "20122",
    "name": "Accumulated Dep - Office Equipments",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Related Party"
  },
  {
    "code": "20123",
    "name": "Accumulated Dep - Computer & Accessories",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Related Party"
  },
  {
    "code": "20132",
    "name": "Accumulated Dep- Building",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Related Party"
  },
  {
    "code": "20104003",
    "name": "Provision For Gratuity",
    "type": "Liability",
    "isPosting": true,
    "parentCode": "20201",
    "category": "LIABILITIES",
    "subCategory": "CURRENT LIABILITY",
    "mainAccount": "Related Party"
  },
  {
    "code": "3",
    "name": "EQUITY",
    "type": "Equity",
    "isPosting": false,
    "parentCode": null,
    "category": "EQUITY",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "3030100001",
    "name": "Mr. Abdelrahman",
    "type": "Equity",
    "isPosting": true,
    "parentCode": "3",
    "category": "EQUITY",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "3030100002",
    "name": "Mr. Mohammed Sameer",
    "type": "Equity",
    "isPosting": true,
    "parentCode": "3",
    "category": "EQUITY",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "3030100003",
    "name": "Mr. Muzammil",
    "type": "Equity",
    "isPosting": true,
    "parentCode": "3",
    "category": "EQUITY",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "4",
    "name": "REVENUES",
    "type": "Revenue",
    "isPosting": false,
    "parentCode": null,
    "category": "REVENUES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "401001",
    "name": "Computer and Software Training",
    "type": "Revenue",
    "isPosting": false,
    "parentCode": "4",
    "category": "REVENUES",
    "subCategory": "Computer and Software Training",
    "mainAccount": null
  },
  {
    "code": "4010010001",
    "name": "Course 1",
    "type": "Revenue",
    "isPosting": true,
    "parentCode": "401001",
    "category": "REVENUES",
    "subCategory": "Computer and Software Training",
    "mainAccount": null
  },
  {
    "code": "401002",
    "name": "Academic Support",
    "type": "Revenue",
    "isPosting": false,
    "parentCode": "4",
    "category": "REVENUES",
    "subCategory": "Academic Support",
    "mainAccount": null
  },
  {
    "code": "4010020001",
    "name": "Course 2",
    "type": "Revenue",
    "isPosting": true,
    "parentCode": "401002",
    "category": "REVENUES",
    "subCategory": "Academic Support",
    "mainAccount": null
  },
  {
    "code": "401003",
    "name": "Test Preparations",
    "type": "Revenue",
    "isPosting": false,
    "parentCode": "4",
    "category": "REVENUES",
    "subCategory": "Test Preparations",
    "mainAccount": null
  },
  {
    "code": "4010030001",
    "name": "Course 3",
    "type": "Revenue",
    "isPosting": true,
    "parentCode": "401003",
    "category": "REVENUES",
    "subCategory": "Test Preparations",
    "mainAccount": null
  },
  {
    "code": "401004",
    "name": "Language Training",
    "type": "Revenue",
    "isPosting": false,
    "parentCode": "4",
    "category": "REVENUES",
    "subCategory": "Language Training",
    "mainAccount": null
  },
  {
    "code": "4010040001",
    "name": "Course 4",
    "type": "Revenue",
    "isPosting": true,
    "parentCode": "401004",
    "category": "REVENUES",
    "subCategory": "Language Training",
    "mainAccount": null
  },
  {
    "code": "401005",
    "name": "Business Admin Training",
    "type": "Revenue",
    "isPosting": false,
    "parentCode": "4",
    "category": "REVENUES",
    "subCategory": "Business Admin Training",
    "mainAccount": null
  },
  {
    "code": "4010050001",
    "name": "Course 5",
    "type": "Revenue",
    "isPosting": true,
    "parentCode": "401005",
    "category": "REVENUES",
    "subCategory": "Business Admin Training",
    "mainAccount": null
  },
  {
    "code": "5",
    "name": "EXPENSES",
    "type": "Expense",
    "isPosting": false,
    "parentCode": null,
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010001",
    "name": "Textbooks",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010002",
    "name": "Drinking Water Expenses",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010003",
    "name": "Salaries Expenses",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010004",
    "name": "Consumable Educational Resources",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010005",
    "name": "Printing And Stationery",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010006",
    "name": "IT Equipments And Tools",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010007",
    "name": "Staff Welfare Other",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010008",
    "name": "Visa Costs",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010009",
    "name": "Marketing & Advertisement",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010010",
    "name": "Fire & Safety",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010011",
    "name": "Pest Control",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010012",
    "name": "IT Equipments Maintenance",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010013",
    "name": "Cleaning & Waste Management Expenses",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010014",
    "name": "Travelling/Conveyance Expenses",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010015",
    "name": "Electricity/Water Charges",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010016",
    "name": "Internet & Telephone Charges",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010017",
    "name": "Miscellaneous Expenses",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010018",
    "name": "Courier And Postage",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010019",
    "name": "Staff Welfare / Appreciation & Recognition",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010020",
    "name": "POS Charges",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010021",
    "name": "SPEA Expenses",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010022",
    "name": "Medical Insurance",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010023",
    "name": "AC Maintenance",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010024",
    "name": "Water Tank Cleaning",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010025",
    "name": "It Subscriptions",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010026",
    "name": "Bank Charges",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010027",
    "name": "STAFF TRAINING & Development",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010028",
    "name": "Educational Subscriptions & License",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010029",
    "name": "Student Welfare",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010030",
    "name": "Teaching Aids And Resources",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010031",
    "name": "Community Events",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010032",
    "name": "Activity Expenses",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010033",
    "name": "Trade License Expenses",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010034",
    "name": "KHDA/SPEA LICENSE",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010035",
    "name": "Land Lease",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010036",
    "name": "Civil Defense Certificate",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010037",
    "name": "Clinic License",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010038",
    "name": "Salaries - Teaching Staff",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010039",
    "name": "Emarati Pensions",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010040",
    "name": "VAT Non-Refundable Expense",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010041",
    "name": "Amc Fire & Safety",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010042",
    "name": "Dep.- Building",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010043",
    "name": "Dep. - Furniture And Fixtures (Students)",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010044",
    "name": "Dep. - Office Equipment",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010045",
    "name": "Dep. - Computer And Accessories",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010046",
    "name": "Teaching Staff - Transportation",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010047",
    "name": "Softwares And Applications",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  },
  {
    "code": "5010010048",
    "name": "Professional Expenses",
    "type": "Expense",
    "isPosting": true,
    "parentCode": "5",
    "category": "EXPENSES",
    "subCategory": null,
    "mainAccount": null
  }
];
