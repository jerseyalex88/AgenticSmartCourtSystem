import React, { useState } from 'react';
import PublicHeader from '../components/PublicHeader';

interface LandingPageProps {
  onNavigate: (route: string) => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [contactForm, setContactForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    captcha: '',
    agree: false
  });

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Contact dispatch payload:", contactForm);
    alert("🚀 Telemetry saved! Your information has been submitted successfully.");
  };

  const campCards = [
    {
      id: 'full-week',
      title: 'Full-Week Tennis Camps',
      description: 'Tennis programs designed for adults of all levels. Immerse yourself in a week of tennis passion and improve your game.',
      imgSrc: 'https://res.cloudinary.com/hjzvstjg/image/upload/v1784940170/pexels-holoshuriken-28625142_ljp4nz.jpg',
      tags: ['Tennis Camps For Adults', 'Adults']
    },
    {
      id: 'flexible',
      title: 'Flexible tennis camps for adults',
      description: 'If you need flexibility in schedules, these are the programs for you. Tailored intervals built around your active routine.',
      imgSrc: 'https://res.cloudinary.com/hjzvstjg/image/upload/v1784940159/pexels-mutecevvil-22931875_c9gqlv.jpg',
      tags: ['Tennis Camps For Adults', 'Adults']
    },
    {
      id: 'holiday',
      title: 'Tennis camps for adults during holiday periods',
      description: 'Tennis programs during Christmas, Easter and summer vacations. Maximize your holiday windows with elite-level coaching tracking loops.',
      imgSrc: 'https://res.cloudinary.com/hjzvstjg/image/upload/v1784940193/pexels-bossistudio-7339312_rely6n.jpg',
      tags: ['Tennis Camps For Adults', 'Adults']
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-teal-500 selection:text-slate-950 overflow-x-hidden">
      
      {/* TOP NOTIFICATION BAR RIBBON */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-500 text-slate-950 text-[11px] font-bold py-2 text-center tracking-wide uppercase px-4 relative z-50 shrink-0">
        ✨ Last spots available! <span className="underline">15% off all our Junior summer programs.</span> Book here!
      </div>

      {/* HEADER NAVIGATION CONTAINER */}
      <PublicHeader onNavigate={onNavigate} />
      
      {/* HERO SECTION MARQUEE */}
      <section className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-900 py-20 px-6 text-center space-y-4">
        <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
          Home &gt; Adults &gt; Tennis Camps For Adults
        </div>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-950 dark:text-slate-100 max-w-2xl mx-auto leading-tight">
          Find your tennis camp for adults
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto font-medium">
          Enjoy a unique tennis experience to improve your game past standard operational limits.
        </p>
      </section>

      {/* CORE CARDS GRID SECTION */}
      <section id="camps" className="max-w-6xl mx-auto py-16 px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {campCards.map((card) => (
            <div 
              key={card.id} 
              className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xl flex flex-col justify-between group hover:border-slate-300 transition duration-300"
            >
              <div>
                <div className="h-56 bg-slate-100 relative overflow-hidden">
                  <img 
                    src={card.imgSrc} 
                    alt={card.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://picsum.photos/600/400`;
                    }}
                  />
                </div>

                <div className="p-6 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {card.tags.map((tag, i) => (
                      <span 
                        key={i} 
                        className="bg-lime-400 text-slate-950 px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wide border border-lime-500/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <h3 className="text-base font-black text-slate-950 tracking-tight group-hover:text-emerald-600 transition">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>

              <div className="px-6 pb-6 pt-2 flex justify-end">
                <button 
                  onClick={() => onNavigate('register')}
                  className="w-8 h-8 rounded-full bg-teal-400 text-slate-950 font-black text-lg flex items-center justify-center transition hover:bg-teal-300 active:scale-95 shadow-md shadow-teal-400/20"
                  title="Inquire details"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* DEEP NAVY FORM SECTION PANEL */}
      <section id="contact" className="max-w-6xl mx-auto pb-20 px-6">
        <div className="bg-slate-950 border border-slate-900 rounded-3xl p-8 lg:p-12 shadow-2xl text-slate-300 relative overflow-hidden grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
          
          <div className="absolute inset-0 opacity-5 pointer-events-none font-black text-8xl uppercase tracking-tighter text-slate-400 select-none p-4">
            Get In Touch
          </div>

          <div className="lg:col-span-2 space-y-4 relative z-10 hidden sm:block">
            <div className="h-64 lg:h-80 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
              <img 
                src="https://res.cloudinary.com/hjzvstjg/image/upload/v1784940180/pexels-rdne-8224677_m2cjv4.jpg" 
                alt="Academy Players" 
                className="w-full h-full object-cover opacity-80"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://picsum.photos/600/400`;
                }}
              />
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6 relative z-10 font-mono text-xs">
            <div>
              <h3 className="text-lg font-black text-slate-100 uppercase tracking-wider font-sans">Contact us</h3>
              <p className="text-[11px] text-slate-500 font-sans mt-0.5">Let's make something happen. Fill out the operational parameters below:</p>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase text-[10px] tracking-wider">Nombre</label>
                  <input 
                    type="text" 
                    required
                    value={contactForm.nombre}
                    onChange={(e) => setContactForm({...contactForm, nombre: e.target.value})}
                    placeholder="Introduzca su nombre" 
                    className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans text-xs" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase text-[10px] tracking-wider">Email</label>
                  <input 
                    type="email" 
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                    placeholder="Déjanos su correo electrónico aquí..." 
                    className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans text-xs" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase text-[10px] tracking-wider">Teléfono</label>
                  <input 
                    type="text" 
                    required
                    value={contactForm.telefono}
                    onChange={(e) => setContactForm({...contactForm, telefono: e.target.value})}
                    placeholder="Tu número de teléfono es..." 
                    className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans text-xs" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase text-[10px] tracking-wider">Captcha</label>
                  <div className="flex gap-2">
                    <div className="bg-slate-900 border border-slate-800 px-3 rounded-xl flex items-center justify-center font-bold tracking-widest text-slate-400 text-xs italic select-none line-through decoration-slate-700">
                      ndVAdZ
                    </div>
                    <input 
                      type="text" 
                      required
                      value={contactForm.captcha}
                      onChange={(e) => setContactForm({...contactForm, captcha: e.target.value})}
                      placeholder="Introducir código captcha" 
                      className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans text-xs" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-2 pt-2">
                <input 
                  type="checkbox" 
                  id="agree" 
                  required
                  checked={contactForm.agree}
                  onChange={(e) => setContactForm({...contactForm, agree: e.target.checked})}
                  className="mt-0.5 accent-emerald-500 cursor-pointer" 
                />
                <label htmlFor="agree" className="text-[10px] text-slate-400 font-sans leading-normal cursor-pointer select-none">
                  I agree to receive commercial communications and understand and accept the <span className="text-teal-400 underline cursor-pointer">privacy policy</span>.
                </label>
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black font-sans uppercase tracking-wider px-5 py-3 rounded-xl text-xs transition duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-400/10 active:scale-[0.99]"
                >
                  <span>Quiero recibir información</span>
                  <span className="text-[10px]">🚀</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </section>

    </div>
  );
}
