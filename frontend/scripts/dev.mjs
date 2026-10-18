// Lance les deux applications en développement (Windows, macOS, Linux) :
// back-office sur http://localhost:5173, espace étudiant sur http://localhost:5174.
import { spawn } from 'node:child_process';

const apps = ['@esign/backoffice', '@esign/etudiant'];
const enfants = apps.map((app) => spawn('npm', ['run', 'dev', '-w', app], { stdio: 'inherit', shell: true }));
const arreter = () => enfants.forEach((e) => e.kill());
process.on('SIGINT', arreter);
process.on('SIGTERM', arreter);
enfants.forEach((e) => e.on('exit', (code) => { if (code) { arreter(); process.exit(code); } }));
