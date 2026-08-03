import { useState, useEffect } from 'react';

interface LandingPageProps {
  onNavigate: (route: string) => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [currentVideo, setCurrentVideo] = useState(0);
  const videos = ['/hero_1.mp4', '/hero_2.mp4', '/hero_3.mp4'];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVideo((prev) => (prev + 1) % videos.length);
    }, 5000); // Switch every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-family-body)' }}>
      
      {/* HERO SECTION - Mobile First (390-430px) */}
      <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
        {/* Video Carousel Background */}
        <div className="absolute inset-0 z-0">
          {videos.map((video, index) => (
            <video
              key={video}
              autoPlay
              muted
              loop
              playsInline
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                index === currentVideo ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ backgroundColor: 'var(--landing-navy)' }}
            >
              <source src={video} type="video/mp4" />
            </video>
          ))}
          {/* Navy overlay for text readability */}
          <div className="absolute inset-0 bg-black/50" style={{ backgroundColor: 'rgba(11, 31, 58, 0.3)' }}></div>
        </div>

        <div className="relative z-10 max-w-md mx-auto text-center space-y-6 py-20">
          <img 
            src="/logo_dark.png" 
            alt="Academy Logo" 
            className="h-32 mx-auto mb-4"
          />
          <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--landing-neon-green)' }}>
            Elite Tennis Academy
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
            Train with purpose.
            <br />
            <span style={{ color: 'var(--landing-neon-green)' }}>Compete with confidence.</span>
          </h1>
          <p className="text-sm md:text-base text-gray-300 max-w-sm mx-auto leading-relaxed">
            Develop confident, disciplined, and high-performing tennis players through innovative coaching and purposeful training.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button 
              onClick={() => onNavigate('register')}
              className="px-8 py-4 font-black uppercase tracking-wider text-sm transition hover:opacity-90"
              style={{ 
                backgroundColor: 'var(--landing-electric-blue)', 
                color: 'white' 
              }}
            >
              Start Your Journey
            </button>
            <button 
              className="px-8 py-4 font-black uppercase tracking-wider text-sm border-2 transition hover:bg-white/10"
              style={{ 
                borderColor: 'var(--landing-neon-green)', 
                color: 'var(--landing-neon-green)' 
              }}
            >
              Explore Programs
            </button>
          </div>
        </div>
      </section>

      {/* PROGRAMS SECTION */}
      <section className="py-20 px-4" style={{ backgroundColor: 'var(--landing-white)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <img 
              src="/logo_light.png" 
              alt="Academy Logo" 
              className="h-32 mx-auto mb-4"
            />
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--landing-navy)' }}>
              Our Programs
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: 'var(--landing-navy)' }}>
              Programs for Every Level
            </h2>
            <p className="text-sm md:text-base max-w-2xl mx-auto" style={{ color: 'var(--landing-dark-gray)' }}>
              From beginners to elite competitors, our programs are designed to unlock your full potential on and off the court.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Junior Development',
                description: 'Build strong foundations for young players aged 6-17 with focus on technique, discipline, and character.',
                level: 'Ages 6-17'
              },
              {
                title: 'Adult Training',
                description: 'Elevate your game with intensive training programs designed for players of all skill levels.',
                level: 'All Levels'
              },
              {
                title: 'Elite Performance',
                description: 'For competitive players seeking to reach their highest potential through advanced coaching and competition.',
                level: 'Advanced'
              }
            ].map((program, index) => (
              <div 
                key={index}
                className="p-6 border-2 hover:shadow-xl transition"
                style={{ 
                  borderColor: 'var(--landing-navy)',
                  backgroundColor: 'white'
                }}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--landing-neon-green)' }}>
                  {program.level}
                </div>
                <h3 className="text-xl font-black mb-3" style={{ color: 'var(--landing-navy)' }}>
                  {program.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--landing-dark-gray)' }}>
                  {program.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COACHES SECTION */}
      <section className="py-20 px-4" style={{ backgroundColor: 'var(--landing-dark-gray)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--landing-neon-green)' }}>
              Our Team
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white">
              World-Class Coaching
            </h2>
            <p className="text-sm md:text-base max-w-2xl mx-auto text-gray-400">
              Learn from experienced coaches who have developed champions at every level of the game.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Head Coach',
                specialty: 'Technical Development',
                experience: '15+ Years'
              },
              {
                name: 'Performance Director',
                specialty: 'Mental Conditioning',
                experience: '20+ Years'
              },
              {
                name: 'Youth Director',
                specialty: 'Junior Development',
                experience: '12+ Years'
              }
            ].map((coach, index) => (
              <div 
                key={index}
                className="text-center space-y-4"
              >
                <div className="w-32 h-32 mx-auto rounded-full flex items-center justify-center text-4xl" 
                     style={{ 
                       backgroundColor: 'var(--landing-navy)',
                       color: 'var(--landing-neon-green)' 
                     }}>
                  👤
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">{coach.name}</h3>
                  <div className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--landing-neon-green)' }}>
                    {coach.specialty}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">{coach.experience}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section className="py-20 px-4" style={{ backgroundColor: 'var(--landing-white)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--landing-navy)' }}>
              Success Stories
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: 'var(--landing-navy)' }}>
              What Our Athletes Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                quote: "The academy transformed my game. The coaches pushed me beyond what I thought was possible, and I'm now competing at a level I never dreamed of.",
                author: 'Elite Player',
                level: 'National Champion'
              },
              {
                quote: "My son has grown not just as a player but as a person. The discipline and confidence he's gained here will serve him for life.",
                author: 'Parent',
                level: 'Junior Program'
              }
            ].map((testimonial, index) => (
              <div 
                key={index}
                className="p-8 border-l-4"
                style={{ 
                  borderColor: 'var(--landing-neon-green)',
                  backgroundColor: 'var(--landing-dark-gray)'
                }}
              >
                <p className="text-white text-sm md:text-base leading-relaxed mb-6 italic">
                  "{testimonial.quote}"
                </p>
                <div>
                  <div className="font-bold text-white">{testimonial.author}</div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--landing-neon-green)' }}>
                    {testimonial.level}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-20 px-4 text-center" style={{ backgroundColor: 'var(--landing-navy)' }}>
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white">
            Ready to Transform Your Game?
          </h2>
          <p className="text-gray-300 text-sm md:text-base">
            Join the academy that develops champions. Start your journey today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => onNavigate('register')}
              className="px-10 py-4 font-black uppercase tracking-wider text-sm transition hover:opacity-90"
              style={{ 
                backgroundColor: 'var(--landing-neon-green)', 
                color: 'var(--landing-navy)' 
              }}
            >
              Get Started Now
            </button>
            <button 
              onClick={() => onNavigate('login')}
              className="px-10 py-4 font-black uppercase tracking-wider text-sm border-2 transition hover:bg-white/10"
              style={{ 
                borderColor: 'var(--landing-electric-blue)', 
                color: 'var(--landing-electric-blue)' 
              }}
            >
              Sign In
            </button>
          </div>
          <img 
            src="/logo_dark.png" 
            alt="Academy Logo" 
            className="h-64 mx-auto mb-8"
          />
        </div>
      </section>

    </div>
  );
}
