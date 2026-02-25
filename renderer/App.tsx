// renderer/App.tsx
const runDiagnostic = async () => {
  const { exec } = window.require('child_process');
  exec('ipconfig /all', (error, stdout) => {
    console.log('Network info:', stdout);
  });
};