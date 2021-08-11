const fs = require("fs");
const Nightmare = require("nightmare");
const vo = require("vo");

let stream;
let separator = "";

vo(function* () {
  stream = fs.createWriteStream(`./data.json`, { flags: "a" });

  const nightmare = Nightmare({
    show: false, // shows the chromium browser
    waitTimeout: 4000, // in ms
    gotoTimeout: 5000,
    loadTimeout: 6000,
    dock: true,
    openDevTools: {
      mode: "detach", // detaches the developer console. Good for debugging
    },
    pollInterval: 50,
  });

  const hrefs = yield nightmare
    .goto("https://iris.nitk.ac.in/hrms")
    .wait("#user_login")
    .wait("#user_password")
    .type("#user_login", "181853")
    .type("#user_password", "prem_sai")
    .wait(`button[type="submit"]`)
    .click(`button[type="submit"]`)
    .wait(2000)
    .goto("https://iris.nitk.ac.in/hrms/placement/companies")
    .wait("#datatable-responsive tbody")
    .wait('[name="datatable-responsive_length"]')
    .select(`[name="datatable-responsive_length"]`, "-1")
    .evaluate(() => {
      const hrefs = [];
      document.querySelectorAll("[role='row'] td a").forEach((link, idx) => {
        if (idx % 3 == 0) {
          hrefs.push({ name: link.innerText, link: link.href });
        }
      });
      return hrefs;
    });

  const jsonObj = [];

  for (let i = 0; i < hrefs.length; i++) {
    console.log(hrefs[i]);
    console.log(`${(i / hrefs.length).toFixed(2) * 100}% Complete`);
    const subhrefs = yield nightmare
      .goto(hrefs[i].link)
      .wait("#scheduleTable")
      .wait(1000)
      .evaluate(() => {
        const subhrefs = [];
        document
          .querySelectorAll(
            "td [href^='/hrms/placement/recruitment_schedules']"
          )
          .forEach((link, idx) => {
            if (idx % 2 == 0) subhrefs.push(link.href);
          });
        return subhrefs;
      });

    const eligibleBranches = [];
    if (subhrefs.length == 0) {
      jsonObj.push({ name: hrefs[i].name, branches: eligibleBranches });
      continue;
    }

    console.log(subhrefs[0]);

    const table1 = yield nightmare
      .goto(subhrefs[0])
      .wait("#table_pre1")
      .select("[name='table_pre1_length']", "100")
      .wait("#table_pre2")
      .select("[name='table_pre2_length']", "100")
      .wait(2000)
      .evaluate(() => {
        const branches = [];
        document
          .querySelectorAll("#table_pre1 tbody tr")
          .forEach((row, idx) => {
            const colList = row.querySelectorAll("td");
            if (colList[0].innerText !== "No data available in table") {
              const branch = {
                branch: colList[0].innerText,
                degreeType: colList[1].innerText,
                programmeType: colList[2].innerText,
                cgpaMin: colList[4].innerText,
              };

              branches.push(branch);
            }
          });
        return branches;
      });

    const table2 = yield nightmare.evaluate(() => {
      const branches = [];
      document.querySelectorAll("#table_pre2 tbody tr").forEach((row, idx) => {
        const colList = row.querySelectorAll("td");
        if (colList[0].innerText !== "No data available in table") {
          const branch = {
            branch: colList[0].innerText,
            degreeType: colList[1].innerText,
            programmeType: colList[2].innerText,
            cgpaMin: colList[4].innerText,
          };

          branches.push(branch);
        }
      });
      return branches;
    });

    eligibleBranches.push(...table1, ...table2);
    const company = { name: hrefs[i].name, branches: eligibleBranches };

    jsonObj.push(company);
    console.log(company);
  }

  stream.write(separator);
  // Properties of non-array objects are not guaranteed to be stringified in any particular order
  // The "2" parameter in JSON.stringify will output formatted JSON with 2 space indentation
  stream.write(JSON.stringify(jsonObj, undefined, 2));
  if (separator === "") {
    separator = ",";
  }

  yield nightmare.end();
  yield nightmare.then((result) => {
    // Append the closing bracket to your data stream to create valid JSON
    stream.end();
    // Display any URLs that had errors during the scrape
  });
})((err, result) => {
  if (err) {
    return console.log(err, result);
  }
});
