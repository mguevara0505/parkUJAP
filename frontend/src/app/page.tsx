export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-500/20 border border-blue-500/30 mb-6">
          <span className="text-4xl">🅿️</span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
          UJAP Parking
        </h1>
        <p className="text-xl text-blue-300 font-medium">
          Sistema de Gestión de Estacionamientos
        </p>
        <p className="text-slate-400 mt-2">
          Universidad José Antonio Páez
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full mb-12">
        <StatusCard
          icon="🖥️"
          title="Aplicación Web"
          description="Interfaz de usuario en desarrollo"
          status="building"
        />
        <StatusCard
          icon="⚙️"
          title="API Backend"
          description="NestJS corriendo en :3001"
          status="ready"
          link="http://localhost:3001/api/v1/health"
        />
        <StatusCard
          icon="📚"
          title="Documentación"
          description="Swagger UI disponible"
          status="ready"
          link="http://localhost:3001/api/v1/docs"
        />
      </div>

      {/* Sprint Status */}
      <div className="max-w-3xl w-full bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">
          📋 Estado del Proyecto
        </h2>
        <div className="space-y-2">
          {sprints.map((sprint) => (
            <div
              key={sprint.number}
              className="flex items-center gap-3 text-sm"
            >
              <span className="text-lg">{sprint.icon}</span>
              <span className="text-slate-300 font-medium w-20">
                Sprint {sprint.number}
              </span>
              <span className="text-slate-400 flex-1">{sprint.name}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${sprint.statusClass}`}
              >
                {sprint.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="flex flex-wrap gap-2 justify-center">
        {tech.map((t) => (
          <span
            key={t}
            className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-slate-300"
          >
            {t}
          </span>
        ))}
      </div>
    </main>
  );
}

function StatusCard({
  icon,
  title,
  description,
  status,
  link,
}: {
  icon: string;
  title: string;
  description: string;
  status: 'ready' | 'building' | 'pending';
  link?: string;
}) {
  const statusStyles = {
    ready: 'bg-green-500/20 text-green-400 border-green-500/30',
    building: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    pending: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  const statusLabels = {
    ready: '✓ Activo',
    building: '⚙ En desarrollo',
    pending: '○ Pendiente',
  };

  const card = (
    <div
      className={`bg-white/5 border rounded-xl p-5 transition-all hover:bg-white/10 ${
        link ? 'cursor-pointer' : ''
      } border-white/10`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles[status]}`}
        >
          {statusLabels[status]}
        </span>
      </div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );

  return link ? (
    <a href={link} target="_blank" rel="noopener noreferrer">
      {card}
    </a>
  ) : (
    card
  );
}

const sprints = [
  { number: 0, name: 'Preparación y estructura base', icon: '✅', statusLabel: 'Completado', statusClass: 'bg-green-500/20 text-green-400' },
  { number: 1, name: 'Autenticación + Usuarios', icon: '✅', statusLabel: 'Completado', statusClass: 'bg-green-500/20 text-green-400' },
  { number: 2, name: 'Estacionamientos + Zonas', icon: '✅', statusLabel: 'Completado', statusClass: 'bg-green-500/20 text-green-400' },
  { number: 3, name: 'Puestos (~1.000)', icon: '✅', statusLabel: 'Completado', statusClass: 'bg-green-500/20 text-green-400' },
  { number: 4, name: 'Mapa Visual SVG', icon: '✅', statusLabel: 'Completado', statusClass: 'bg-green-500/20 text-green-400' },
  { number: 5, name: 'Check-in / Check-out', icon: '⏳', statusLabel: 'Siguiente', statusClass: 'bg-blue-500/20 text-blue-400' },
];

const tech = [
  'NestJS 11', 'TypeScript', 'Prisma 7', 'PostgreSQL 16',
  'Next.js 16', 'Tailwind CSS', 'JWT', 'Swagger/OpenAPI', 'Docker',
];
