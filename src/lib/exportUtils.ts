export interface ExportData {
  games: GameExport[];
  trainingSessions: TrainingExport[];
  statistics: StatisticsExport;
  generatedAt: string;
}

export interface GameExport {
  id: string;
  date: string;
  gameType: string;
  startingScore: number;
  result: 'win' | 'loss';
  opponent: string;
  avgScore: number;
  checkouts: number[];
  dartsThrown: number;
}

export interface TrainingExport {
  id: string;
  date: string;
  drillName: string;
  score: number;
  duration: number;
  metrics: Record<string, number>;
}

export interface StatisticsExport {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  avgScore: number;
  bestAvg: number;
  highestCheckout: number;
  totalCheckouts: number;
  checkoutRate: number;
  total180s: number;
  total140plus: number;
  trainingHours: number;
  favoriteDouble: string;
}

export function generateCSV(data: ExportData): string {
  const lines: string[] = [];

  lines.push('DARTS STATISTICS EXPORT');
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push('');

  lines.push('=== OVERALL STATISTICS ===');
  lines.push('Metric,Value');
  lines.push(`Total Games,${data.statistics.totalGames}`);
  lines.push(`Wins,${data.statistics.wins}`);
  lines.push(`Losses,${data.statistics.losses}`);
  lines.push(`Win Rate,${data.statistics.winRate.toFixed(1)}%`);
  lines.push(`Average Score,${data.statistics.avgScore.toFixed(2)}`);
  lines.push(`Best Average,${data.statistics.bestAvg.toFixed(2)}`);
  lines.push(`Highest Checkout,${data.statistics.highestCheckout}`);
  lines.push(`Checkout Rate,${data.statistics.checkoutRate.toFixed(1)}%`);
  lines.push(`Total 180s,${data.statistics.total180s}`);
  lines.push(`Total 140+,${data.statistics.total140plus}`);
  lines.push(`Training Hours,${data.statistics.trainingHours.toFixed(1)}`);
  lines.push(`Favorite Double,${data.statistics.favoriteDouble}`);
  lines.push('');

  lines.push('=== GAME HISTORY ===');
  lines.push('Date,Game Type,Starting Score,Result,Opponent,Avg Score,Darts Thrown');
  data.games.forEach((game) => {
    lines.push(
      `${game.date},${game.gameType},${game.startingScore},${game.result},${game.opponent},${game.avgScore.toFixed(2)},${game.dartsThrown}`
    );
  });
  lines.push('');

  lines.push('=== TRAINING SESSIONS ===');
  lines.push('Date,Drill,Score,Duration (min)');
  data.trainingSessions.forEach((session) => {
    lines.push(
      `${session.date},${session.drillName},${session.score},${session.duration}`
    );
  });

  return lines.join('\n');
}

export function generateJSON(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAsCSV(data: ExportData, filename?: string) {
  const csv = generateCSV(data);
  const date = new Date().toISOString().split('T')[0];
  downloadFile(csv, filename || `darts-stats-${date}.csv`, 'text/csv');
}

export function exportAsJSON(data: ExportData, filename?: string) {
  const json = generateJSON(data);
  const date = new Date().toISOString().split('T')[0];
  downloadFile(json, filename || `darts-stats-${date}.json`, 'application/json');
}

export async function generatePDFContent(data: ExportData): Promise<string> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Darts Statistics Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
    h2 { color: #2563eb; margin-top: 30px; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #1e3a5f; }
    .stat-label { color: #6b7280; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: 600; }
    .win { color: #10b981; }
    .loss { color: #ef4444; }
    .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Darts Statistics Report</h1>
  <p>Generated: ${data.generatedAt}</p>

  <h2>Overall Performance</h2>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-value">${data.statistics.totalGames}</div>
      <div class="stat-label">Games Played</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.statistics.winRate.toFixed(1)}%</div>
      <div class="stat-label">Win Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.statistics.avgScore.toFixed(1)}</div>
      <div class="stat-label">Average Score</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.statistics.highestCheckout}</div>
      <div class="stat-label">Highest Checkout</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.statistics.total180s}</div>
      <div class="stat-label">Total 180s</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.statistics.checkoutRate.toFixed(1)}%</div>
      <div class="stat-label">Checkout Rate</div>
    </div>
  </div>

  <h2>Recent Games</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Opponent</th>
        <th>Result</th>
        <th>Avg</th>
      </tr>
    </thead>
    <tbody>
      ${data.games.slice(0, 20).map((game) => `
        <tr>
          <td>${game.date}</td>
          <td>${game.gameType}</td>
          <td>${game.opponent}</td>
          <td class="${game.result}">${game.result.toUpperCase()}</td>
          <td>${game.avgScore.toFixed(1)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>Training Summary</h2>
  <p>Total training sessions: ${data.trainingSessions.length}</p>
  <p>Total training time: ${data.statistics.trainingHours.toFixed(1)} hours</p>

  <div class="footer">
    <p>Generated by Darts Training App</p>
  </div>
</body>
</html>
  `;

  return html;
}

export async function printReport(data: ExportData) {
  const html = await generatePDFContent(data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
}
