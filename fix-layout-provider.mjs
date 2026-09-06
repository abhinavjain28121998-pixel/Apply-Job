import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /const location = useLocation\(\);/g,
  `const location = useLocation();
  const [providerStatus, setProviderStatus] = React.useState<any>(null);
  
  React.useEffect(() => {
    fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1 })
    })
    .then(res => res.json())
    .then(data => {
       if (data && data.status) setProviderStatus(data.status);
    })
    .catch(console.error);
  }, []);`
);

content = content.replace(
  /<div className="flex items-center gap-4">[\s\S]*?<\/div>\s*<\/header>/g,
  `<div className="flex items-center gap-4">
            {providerStatus?.status === 'DEMO' && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-medium">
                Demo Mode &middot; Mock Jobs
              </div>
            )}
            {providerStatus?.status === 'CONNECTED' && (
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Live Provider &middot; Connected
              </div>
            )}
            {providerStatus?.status === 'NOT_CONFIGURED' && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full font-medium">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                Provider Not Configured
              </div>
            )}
          </div>
        </header>`
);

fs.writeFileSync('src/App.tsx', content);
