const sizeChart = [
  { size: 'XS', bust: '78-82', waist: '60-64', hips: '86-90', uk: '6' },
  { size: 'S', bust: '82-86', waist: '64-68', hips: '90-94', uk: '8' },
  { size: 'M', bust: '86-90', waist: '68-72', hips: '94-98', uk: '10' },
  { size: 'L', bust: '90-94', waist: '72-76', hips: '98-102', uk: '12' },
  { size: 'XL', bust: '94-100', waist: '76-82', hips: '102-108', uk: '14' },
  { size: 'XXL', bust: '100-106', waist: '82-88', hips: '108-114', uk: '16' },
];

const mensChart = [
  { size: 'S', chest: '86-90', waist: '76-80', uk: '36' },
  { size: 'M', chest: '90-96', waist: '80-86', uk: '38' },
  { size: 'L', chest: '96-102', waist: '86-92', uk: '40' },
  { size: 'XL', chest: '102-108', waist: '92-98', uk: '42' },
  { size: 'XXL', chest: '108-114', waist: '98-104', uk: '44' },
];

export function SizeGuidePage() {
  return (
    <div className="container-vestra py-12 lg:py-20 max-w-3xl mx-auto">
      <h1 className="font-display text-4xl lg:text-5xl mb-4 text-center">Size Guide</h1>
      <p className="text-muted-foreground text-center mb-12">All measurements are in centimetres. Use these charts as general guidance; automated ML size recommendation is not yet available.</p>

      <section className="mb-12">
        <h2 className="font-display text-2xl mb-6">Women's Size Guide</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold">Size</th>
                <th className="text-left py-3 px-4 font-semibold">Bust (cm)</th>
                <th className="text-left py-3 px-4 font-semibold">Waist (cm)</th>
                <th className="text-left py-3 px-4 font-semibold">Hips (cm)</th>
                <th className="text-left py-3 px-4 font-semibold">UK</th>
              </tr>
            </thead>
            <tbody>
              {sizeChart.map((row) => (
                <tr key={row.size} className="border-b border-border">
                  <td className="py-3 px-4 font-medium">{row.size}</td>
                  <td className="py-3 px-4 text-muted-foreground">{row.bust}</td>
                  <td className="py-3 px-4 text-muted-foreground">{row.waist}</td>
                  <td className="py-3 px-4 text-muted-foreground">{row.hips}</td>
                  <td className="py-3 px-4 text-muted-foreground">{row.uk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-2xl mb-6">Men's Size Guide</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold">Size</th>
                <th className="text-left py-3 px-4 font-semibold">Chest (cm)</th>
                <th className="text-left py-3 px-4 font-semibold">Waist (cm)</th>
                <th className="text-left py-3 px-4 font-semibold">UK</th>
              </tr>
            </thead>
            <tbody>
              {mensChart.map((row) => (
                <tr key={row.size} className="border-b border-border">
                  <td className="py-3 px-4 font-medium">{row.size}</td>
                  <td className="py-3 px-4 text-muted-foreground">{row.chest}</td>
                  <td className="py-3 px-4 text-muted-foreground">{row.waist}</td>
                  <td className="py-3 px-4 text-muted-foreground">{row.uk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-ai-background rounded-xl p-6">
        <h2 className="font-display text-xl mb-2">How to Measure</h2>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
          <li><strong className="text-foreground">Bust:</strong> Measure around the fullest part of your chest, keeping the tape level.</li>
          <li><strong className="text-foreground">Waist:</strong> Measure around your natural waistline, the narrowest part of your torso.</li>
          <li><strong className="text-foreground">Hips:</strong> Measure around the fullest part of your hips, approximately 20cm below your waist.</li>
          <li><strong className="text-foreground">Inseam:</strong> Measure from the top of your inner thigh to your ankle.</li>
        </ul>
        <p className="text-sm text-muted-foreground mt-4">You may save measurements in your account for future fit tools. Until Phase 13, choose sizes using the product details and these charts.</p>
      </section>
    </div>
  );
}
