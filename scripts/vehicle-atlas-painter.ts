import layout from '../src/rendering/vehicles/assets/bkm32100d-atlas-layout.json';

const ATLAS_SIZE = layout.size;
const REGIONS = layout.regions;
type VehicleTextureRegion = keyof typeof REGIONS;

type Painter = (context: CanvasRenderingContext2D, width: number, height: number) => void;

function screw(context: CanvasRenderingContext2D, x: number, y: number, radius = 3) {
  context.fillStyle = '#849198';
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#33454e';
  context.lineWidth = Math.max(1, radius * 0.36);
  context.beginPath();
  context.moveTo(x - radius * 0.58, y + radius * 0.3);
  context.lineTo(x + radius * 0.58, y - radius * 0.3);
  context.stroke();
}

function border(context: CanvasRenderingContext2D, width: number, height: number) {
  context.strokeStyle = '#102b3c';
  context.lineWidth = 2;
  context.strokeRect(4, 4, width - 8, height - 8);
  context.strokeStyle = 'rgba(214,234,245,0.28)';
  context.lineWidth = 1;
  context.strokeRect(7, 7, width - 14, height - 14);
  for (const x of [14, width - 14]) for (const y of [14, height - 14]) screw(context, x, y, 2.5);
}

function circle(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
}

function lamp(color: string, highlight: string): Painter {
  return (context, width, height) => {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.47;
    const lens = context.createRadialGradient(
      cx - radius * 0.28,
      cy - radius * 0.3,
      2,
      cx,
      cy,
      radius,
    );
    lens.addColorStop(0, highlight);
    lens.addColorStop(0.5, color);
    lens.addColorStop(1, '#402a26');
    circle(context, cx, cy, radius);
    context.fillStyle = '#283038';
    context.fill();
    circle(context, cx, cy, radius - 4);
    context.fillStyle = lens;
    context.fill();
    context.save();
    circle(context, cx, cy, radius - 5);
    context.clip();
    context.strokeStyle = 'rgba(255,236,213,0.28)';
    context.lineWidth = 1;
    for (let x = 0; x < width; x += 6) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y < height; y += 6) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    context.restore();
    context.strokeStyle = 'rgba(255,242,222,0.64)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, radius - 9, Math.PI * 1.12, Math.PI * 1.78);
    context.stroke();
  };
}

/** Offline-only source artwork for the checked-in PNG; never imported by the app. */
export function createVehicleAtlasCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot create the vehicle texture atlas.');
  const paint = (region: VehicleTextureRegion, painter: Painter) => {
    const [x, y, width, height] = REGIONS[region];
    context.save();
    context.translate(x, y);
    context.beginPath();
    context.rect(0, 0, width, height);
    context.clip();
    painter(context, width, height);
    context.restore();
  };

  paint('louver', (ctx, width, height) => {
    ctx.fillStyle = '#23333b';
    ctx.fillRect(0, 0, width, height);
    for (let y = 16; y < height - 12; y += 21) {
      ctx.fillStyle = '#101c22';
      ctx.fillRect(15, y, width - 30, 13);
      ctx.fillStyle = '#52636c';
      ctx.fillRect(17, y, width - 34, 3);
      ctx.fillStyle = '#344751';
      ctx.fillRect(17, y + 3, width - 34, 4);
      ctx.fillStyle = '#1c2930';
      ctx.fillRect(16, y + 12, width - 32, 2);
    }
    border(ctx, width, height);
  });

  paint('perforated', (ctx, width, height) => {
    ctx.fillStyle = '#48565d';
    ctx.fillRect(0, 0, width, height);
    for (let y = 10, row = 0; y < height - 8; y += 9, row++) {
      for (let x = 10 + (row % 2) * 4.5; x < width - 8; x += 9) {
        circle(ctx, x, y, 2.65);
        ctx.fillStyle = '#162329';
        ctx.fill();
        ctx.fillStyle = '#697980';
        ctx.fillRect(x - 1, y + 3, 2, 0.6);
      }
    }
    border(ctx, width, height);
  });

  paint('servicePanel', (ctx, width, height) => {
    border(ctx, width, height);
    for (const y of [height * 0.22, height * 0.76]) {
      ctx.fillStyle = '#547f96';
      ctx.fillRect(3, y, 8, 22);
      ctx.fillStyle = '#9bb5c2';
      ctx.fillRect(4, y + 2, 2, 18);
      screw(ctx, 8, y + 11, 2);
    }
    ctx.strokeStyle = '#31566d';
    ctx.lineWidth = 2;
    ctx.strokeRect(width - 31, height * 0.5 - 12, 17, 24);
    ctx.fillStyle = '#b9c5ca';
    ctx.fillRect(width - 28, height * 0.5 - 3, 11, 5);
    ctx.fillStyle = '#163547';
    ctx.fillRect(width - 23, height * 0.5 - 2, 2, 3);
  });

  paint('roofPanel', (ctx, width, height) => {
    border(ctx, width, height);
    ctx.strokeStyle = 'rgba(29,78,106,0.6)';
    for (const x of [width / 3, (width * 2) / 3]) {
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.lineTo(x, height - 8);
      ctx.stroke();
      screw(ctx, x, 17, 2.5);
      screw(ctx, x, height - 17, 2.5);
    }
    ctx.strokeStyle = '#496d81';
    ctx.lineWidth = 3;
    for (const x of [width * 0.2, width * 0.8]) ctx.strokeRect(x - 12, height / 2 - 4, 24, 8);
  });

  paint('branding', (ctx, width, height) => {
    ctx.strokeStyle = '#e3efed';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(18, 27);
    ctx.quadraticCurveTo(42, 16, 65, 27);
    ctx.lineTo(61, 60);
    ctx.quadraticCurveTo(48, 80, 41, 84);
    ctx.quadraticCurveTo(28, 75, 21, 60);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(25, 45);
    ctx.quadraticCurveTo(40, 35, 59, 45);
    ctx.moveTo(26, 56);
    ctx.quadraticCurveTo(40, 46, 57, 56);
    ctx.stroke();
    ctx.fillStyle = '#e3efed';
    ctx.font = '500 75px Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Дніпро', 89, height / 2 + 3, width - 100);
  });

  const display =
    (numberOnly: boolean): Painter =>
    (ctx, width, height) => {
      ctx.fillStyle = '#10191c';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#354045';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, width - 4, height - 4);
      ctx.fillStyle = '#ffc465';
      ctx.textBaseline = 'middle';
      ctx.textAlign = numberOnly ? 'center' : 'left';
      ctx.font = '600 104px monospace';
      ctx.fillText('6', numberOnly ? width / 2 : 20, height / 2 + 4);
      if (!numberOnly) {
        ctx.font = '600 34px Arial, sans-serif';
        ctx.fillText('ж/м ПРИДНІПРОВСЬКИЙ', 106, 43, width - 122);
        ctx.fillText('ПЛОЩА СОБОРНА', 106, 88, width - 122);
      }
      // Subtle LED pitch stays legible as the texture minifies.
      ctx.fillStyle = 'rgba(15,20,19,0.36)';
      for (let x = 0; x < width; x += 4) ctx.fillRect(x, 0, 1, height);
      for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);
    };
  paint('destination', display(false));
  paint('routeNumber', display(true));

  paint('accessibility', (ctx) => {
    for (const x of [50, 152, 254]) {
      circle(ctx, x, 64, 43);
      ctx.fillStyle = '#1e3c4d';
      ctx.fill();
      ctx.strokeStyle = '#cbdedc';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.strokeStyle = '#eff1df';
    ctx.fillStyle = '#eff1df';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    // Pedestrian.
    circle(ctx, 50, 38, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(50, 51);
    ctx.lineTo(50, 70);
    ctx.moveTo(37, 66);
    ctx.lineTo(50, 51);
    ctx.lineTo(63, 65);
    ctx.moveTo(40, 91);
    ctx.lineTo(50, 70);
    ctx.lineTo(59, 90);
    ctx.stroke();
    // Wheelchair.
    circle(ctx, 151, 35, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(147, 77, 19, -0.22, Math.PI * 1.48);
    ctx.moveTo(150, 47);
    ctx.lineTo(151, 68);
    ctx.lineTo(168, 68);
    ctx.lineTo(176, 85);
    ctx.moveTo(153, 52);
    ctx.lineTo(166, 52);
    ctx.stroke();
    // Pram.
    ctx.beginPath();
    ctx.moveTo(231, 64);
    ctx.lineTo(272, 64);
    ctx.lineTo(263, 80);
    ctx.lineTo(242, 80);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(231, 64);
    ctx.lineTo(227, 51);
    ctx.lineTo(220, 51);
    ctx.moveTo(249, 61);
    ctx.lineTo(249, 42);
    ctx.quadraticCurveTo(266, 44, 270, 61);
    ctx.stroke();
    for (const x of [242, 265]) {
      circle(ctx, x, 91, 4);
      ctx.fill();
    }
  });

  paint('highVoltage', (ctx, width, height) => {
    ctx.beginPath();
    ctx.moveTo(width / 2, 6);
    ctx.lineTo(width - 7, height - 10);
    ctx.lineTo(7, height - 10);
    ctx.closePath();
    ctx.fillStyle = '#efd25f';
    ctx.fill();
    ctx.strokeStyle = '#293433';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(70, 31);
    ctx.lineTo(45, 70);
    ctx.lineTo(63, 67);
    ctx.lineTo(54, 101);
    ctx.lineTo(83, 58);
    ctx.lineTo(65, 61);
    ctx.closePath();
    ctx.fillStyle = '#263233';
    ctx.fill();
  });

  paint('serviceNotice', (ctx, width) => {
    ctx.fillStyle = '#dfebe4';
    ctx.textAlign = 'center';
    ctx.font = '600 23px Arial, sans-serif';
    ctx.fillText('ЕЛЕКТРООБЛАДНАННЯ', width / 2, 34, width - 12);
    ctx.font = '19px Arial, sans-serif';
    ctx.fillText('ВІДКРИВАТИ ПІСЛЯ', width / 2, 68);
    ctx.fillText('ВІДКЛЮЧЕННЯ НАПРУГИ', width / 2, 96, width - 12);
  });

  paint('doorLabel', (ctx, width) => {
    ctx.fillStyle = '#f2d47b';
    ctx.font = '600 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ОБЕРЕЖНО, ДВЕРІ', width / 2, 30);
    ctx.strokeStyle = '#e7c463';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(43, 67);
    ctx.lineTo(91, 67);
    ctx.lineTo(82, 59);
    ctx.moveTo(91, 67);
    ctx.lineTo(82, 75);
    ctx.moveTo(197, 67);
    ctx.lineTo(149, 67);
    ctx.lineTo(158, 59);
    ctx.moveTo(149, 67);
    ctx.lineTo(158, 75);
    ctx.stroke();
  });

  paint('headlamp', (ctx, width, height) => {
    // The 32100D uses one broad clear lens with three distinct reflector bowls.
    const surround = ctx.createLinearGradient(0, 0, 0, height);
    surround.addColorStop(0, '#e6ece8');
    surround.addColorStop(0.32, '#9eacb0');
    surround.addColorStop(0.68, '#41515d');
    surround.addColorStop(1, '#d9e0dd');
    ctx.fillStyle = '#15272e';
    ctx.beginPath();
    ctx.roundRect(1, 1, width - 2, height - 2, 12);
    ctx.fill();
    ctx.fillStyle = surround;
    ctx.beginPath();
    ctx.roundRect(4, 4, width - 8, height - 8, 9);
    ctx.fill();
    ctx.fillStyle = '#435159';
    ctx.beginPath();
    ctx.roundRect(8, 8, width - 16, height - 16, 6);
    ctx.fill();
    for (const [x, radius] of [
      [48, 34],
      [125, 34],
      [196, 28],
    ]) {
      const cy = height / 2;
      const reflector = ctx.createRadialGradient(x - 3, cy - 4, 2, x, cy, radius);
      reflector.addColorStop(0, '#fdfbf0');
      reflector.addColorStop(0.19, '#e6e5d9');
      reflector.addColorStop(0.34, '#697e8d');
      reflector.addColorStop(0.48, '#d4dedc');
      reflector.addColorStop(0.7, '#f2f2e9');
      reflector.addColorStop(0.86, '#8b9ba2');
      reflector.addColorStop(1, '#dce4df');
      circle(ctx, x, cy, radius);
      ctx.fillStyle = reflector;
      ctx.fill();
      ctx.strokeStyle = '#d0dad8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(57,75,84,0.32)';
      ctx.lineWidth = 1;
      for (let step = 0; step < 20; step++) {
        const angle = (step / 20) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * radius * 0.43, cy + Math.sin(angle) * radius * 0.43);
        ctx.lineTo(x + Math.cos(angle) * radius * 0.91, cy + Math.sin(angle) * radius * 0.91);
        ctx.stroke();
      }
      circle(ctx, x, cy, radius * 0.13);
      ctx.fillStyle = '#fffbed';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(242,248,246,0.16)';
    ctx.lineWidth = 1;
    for (let x = 11; x < width - 9; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x, 11);
      ctx.lineTo(x, height - 11);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(239,247,247,0.22)';
    ctx.fillRect(16, 13, width - 32, 3);
    for (const x of [9, width - 9]) screw(ctx, x, height - 10, 2);
  });
  paint('tailLamp', lamp('#b52f27', '#f49376'));
  paint('amberLamp', lamp('#cf852b', '#ffdc7b'));

  paint('tireSidewall', (ctx, width, height) => {
    const cx = width / 2;
    const cy = height / 2;
    ctx.strokeStyle = '#4a5052';
    ctx.lineWidth = 1.5;
    for (const radius of [58, 64, 72]) {
      circle(ctx, cx, cy, radius);
      ctx.stroke();
    }
    ctx.fillStyle = '#697071';
    ctx.textAlign = 'center';
    ctx.font = '8px Arial, sans-serif';
    ctx.fillText('275 / 70 R 22.5', cx, 27);
    ctx.font = '7px Arial, sans-serif';
    ctx.fillText('URBAN · TUBELESS', cx, height - 22);
    for (let index = 0; index < 36; index++) {
      const angle = (index / 36) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = '#3f474b';
      ctx.fillRect(73, -0.7, 4, 1.4);
      ctx.restore();
    }
  });

  paint('wheelHub', (ctx, width, height) => {
    const cx = width / 2;
    const cy = height / 2;
    ctx.strokeStyle = '#5c6b73';
    ctx.lineWidth = 2;
    circle(ctx, cx, cy, 73);
    ctx.stroke();
    circle(ctx, cx, cy, 40);
    ctx.stroke();
    for (let index = 0; index < 10; index++) {
      const angle = (index / 10) * Math.PI * 2;
      screw(ctx, cx + Math.cos(angle) * 32, cy + Math.sin(angle) * 32, 4);
    }
    ctx.fillStyle = '#77868d';
    circle(ctx, cx, cy, 23);
    ctx.fill();
    ctx.strokeStyle = '#c2ccd0';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  paint('makerBadge', (ctx) => {
    const metal = ctx.createLinearGradient(0, 36, 0, 119);
    metal.addColorStop(0, '#f1f2ea');
    metal.addColorStop(0.3, '#bbc4c6');
    metal.addColorStop(0.47, '#f4f3e7');
    metal.addColorStop(0.55, '#697f89');
    metal.addColorStop(0.8, '#c2cbc9');
    metal.addColorStop(1, '#778b95');
    ctx.fillStyle = metal;
    ctx.strokeStyle = '#5a747f';
    ctx.lineWidth = 1;
    for (const y of [39, 61, 83]) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(64, y + 24);
      ctx.lineTo(118, y);
      ctx.lineTo(118, y + 15);
      ctx.lineTo(64, y + 39);
      ctx.lineTo(10, y + 15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,247,0.65)';
    ctx.beginPath();
    ctx.moveTo(64, 65);
    ctx.lineTo(64, 120);
    ctx.stroke();
  });

  paint('technicalPlate', (ctx, width, height) => {
    ctx.fillStyle = '#a9b7bd';
    ctx.fillRect(6, 10, width - 12, height - 20);
    ctx.fillStyle = '#263f4c';
    ctx.textAlign = 'center';
    ctx.font = '600 15px Arial, sans-serif';
    ctx.fillText('ЕЛЕКТРОТРАНСПОРТ', width / 2, 40, width - 21);
    ctx.font = '13px monospace';
    ctx.fillText('БКМ 32100D', width / 2, 67);
    ctx.fillText('600 V DC', width / 2, 90);
    ctx.fillText('12.0 m / 2.55 m', width / 2, 115, width - 22);
    for (const x of [13, width - 13]) for (const y of [17, height - 17]) screw(ctx, x, y, 2);
  });

  return canvas;
}
