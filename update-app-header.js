const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// replace the header right part
content = content.replace(
  /<div className="flex items-center gap-4">[\s\S]*?Connected\s*<\/div>\s*<\/div>/g,
  `
          <div className="flex items-center gap-4">
            {user?.isDemo && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-medium">
                Demo Mode · Mock Jobs
              </div>
            )}
            {!user?.isDemo && (
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Live Provider · Connected
              </div>
            )}
          </div>`
);

fs.writeFileSync('src/App.tsx', content);
