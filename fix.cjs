const fs = require("fs");
const file = "c:/Users/Antigravity_Pasi/Documents/Antigravity Laiterekisteri/src/pages/AlertsDashboard.tsx";
let code = fs.readFileSync(file, "utf8");

code = code.replace(
  '<div className="alerts-grid">\r\n        \r\n        {/* Device Distribution Chart */}',
  '<div className="alerts-grid">\r\n        <div className="alerts-col-left">\r\n        {/* Device Distribution Chart */}'
);

code = code.replace(
  '<div className="alerts-grid">\n        \n        {/* Device Distribution Chart */}',
  '<div className="alerts-grid">\n        <div className="alerts-col-left">\n        {/* Device Distribution Chart */}'
);

code = code.replace(
  '        {/* Inactive Devices Card */}',
  '        </div>\n        <div className="alerts-col-right">\n        {/* Inactive Devices Card */}'
);

code = code.replace(
  '        {/* Lifecycle Expiring Devices Card */}',
  '        </div>\n      </div>\n\n      {/* Lifecycle Expiring Devices Card */}'
);

fs.writeFileSync(file, code);
