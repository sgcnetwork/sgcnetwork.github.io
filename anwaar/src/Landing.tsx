import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, ArrowUpRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Compass, GraduationCap, Heart, History, LayoutDashboard, MessageCircle, Quote, Scale, Sparkles, Users} from 'lucide-react';
import {subjects} from './model';
import studyPhoto from './quraan-study.webp';
import classroomPhoto from './madressa-classroom.webp';

const descriptions = [
  'Build confidence in recitation and practise the rules of Tajweed.',
  'Learn supplications to use throughout your day.',
  'Understand the practical rulings that guide worship and daily life.',
  'Explore the people and events that shaped our Islamic heritage.',
  'Build a foundation in the core beliefs of Islam.',
  'Study the teachings of the Prophet ﷺ and reflect on how to live them.',
  'Make remembrance of Allah a regular part of your day.',
];

const studyPrompts = [
  'Try reading one short passage slowly. Ask your teacher to check where each letter is pronounced.',
  'Pick one daily routine, such as eating or travelling, and practise the dua that goes with it.',
  'Choose a step in wudu you want to understand better and bring that question to class.',
  'After studying an event, retell it in your own words and reflect on one lesson it teaches.',
  'Write down one question about a core belief and bring it to your next lesson.',
  'Choose one teaching from your lesson and think of a way to put it into practice this week.',
  'Choose a regular moment in your day to pause and remember Allah.',
];

const slides = [
  {label:'Our vision', title:'A lifelong connection with the Quraan.', text:'Madressa Anwaar Ul Quraan helps learners build a lifelong connection with the Quraan and carry Islamic knowledge into everyday life.', photo:studyPhoto, target:'#vision', action:'Discover our vision'},
  {label:'Our classes', title:'Find your place to learn.', text:'Learn together in Sunday group classes or arrange private lessons in person or online. Adults, children and new Muslims are welcome.', photo:classroomPhoto, target:'#enrolment', action:'Find a class'},
];

const subjectIcons = [BookOpen, Heart, Scale, History, Compass, Quote, Sparkles];

const enquiry = 'https://wa.me/27822114583?text=Assalaamu%20alaykum%2C%20I%20would%20like%20to%20enquire%20about%202027%20registration.';

export default function Landing({enter}:{enter:(view:string, demo?:boolean)=>void}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState(0);
  const landingRef = useRef<HTMLElement>(null);
  const subjectButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const slide = slides[slideIndex];
  const SubjectIcon = subjectIcons[selectedSubject];

  useEffect(() => {
    if (!landingRef.current || !('IntersectionObserver' in window)) return;
    const panels = Array.from(landingRef.current.querySelectorAll('[data-reveal]'));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('anwaar-arrived');
        observer.unobserve(entry.target);
      }
    }, {threshold:0.12});
    panels.forEach(panel => observer.observe(panel));
    return () => observer.disconnect();
  }, []);

  function navigateSubjects(event:React.KeyboardEvent<HTMLDivElement>) {
    const offsets:Record<string,number> = {ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1};
    const {key} = event;
    if (!(key in offsets) && key !== 'Home' && key !== 'End') return;
    event.preventDefault();
    const last = subjects.length - 1;
    const next = key === 'Home' ? 0 : key === 'End' ? last : (selectedSubject + offsets[key] + subjects.length) % subjects.length;
    setSelectedSubject(next);
    subjectButtons.current[next]?.focus();
  }

  return <main ref={landingRef} className="anwaar-landing" id="madressa">
    <div className="anwaar-scroll-progress" aria-hidden="true"/>
    <section className="anwaar-hero anwaar-cinema" aria-labelledby="anwaar-title" aria-roledescription="carousel">
      <div className="anwaar-scenes" aria-hidden="true">
        {slides.map((item,index)=><div key={item.label} className={index===slideIndex?'anwaar-scene is-current':'anwaar-scene'}><img src={item.photo} alt="" fetchPriority={index===0?'high':'low'}/></div>)}
      </div>
      <div className="anwaar-cinema-light" aria-hidden="true"/>
      <div className="anwaar-cinema-inner">
        <div className="anwaar-cinema-brand">
          <p lang="ar" dir="rtl">أنوار القرآن</p>
          <h1 id="anwaar-title">Madressa Anwaar Ul Quraan</h1>
        </div>
        <span className="anwaar-sr-only" role="status">{slide.label} selected</span>
        <div key={slide.label} className="anwaar-slide-copy">
          <p className="anwaar-cinema-title">{slide.title}</p>
          <p className="anwaar-lede">{slide.text}</p>
          <div className="anwaar-actions"><a className="anwaar-gold" href={slide.target}>{slide.action} <ArrowRight size={17}/></a><button className="anwaar-outline" onClick={()=>enter('student')}>Student hub <ArrowUpRight size={17}/></button></div>
        </div>
        <div className="anwaar-slider" role="group" aria-label="Landing page slides">
          {slides.map((item,index)=><button key={item.label} type="button" aria-pressed={index===slideIndex} onClick={()=>setSlideIndex(index)}>{item.label}</button>)}
          <button type="button" className="anwaar-slide-arrow" aria-label="Previous slide" onClick={()=>setSlideIndex(index=>(index+slides.length-1)%slides.length)}><ChevronLeft size={20}/></button>
          <button type="button" className="anwaar-slide-arrow" aria-label="Next slide" onClick={()=>setSlideIndex(index=>(index+1)%slides.length)}><ChevronRight size={20}/></button>
        </div>
      </div>
    </section>

    <div className="anwaar-quick-links" aria-label="Explore the madressa">
      <a href="#curriculum"><BookOpen size={20}/> Explore the curriculum <ArrowUpRight size={15}/></a>
      <a href="#enrolment"><CalendarDays size={20}/> Find a class <ArrowUpRight size={15}/></a>
      <button onClick={()=>enter('student')}><GraduationCap size={21}/> Go to the Student Hub <ArrowUpRight size={15}/></button>
    </div>

    <section className="anwaar-mission" id="vision" aria-labelledby="vision-title">
      <div><p className="anwaar-kicker">Our vision &amp; aims</p><h2 id="vision-title">Learn with understanding.<br/><em>Live what you learn.</em></h2></div>
      <div className="anwaar-aims" data-reveal>
        <article><BookOpen/><div><h3>Read with confidence</h3><p>Help learners build confidence in reading the Quraan through guided recitation and Tajweed practice.</p></div></article>
        <article><Compass/><div><h3>Build Islamic foundations</h3><p>Help students understand the beliefs and practices that guide everyday Muslim life.</p></div></article>
        <article><Heart/><div><h3>Make room for every learner</h3><p>Welcome children, adults and new Muslims, with group and private lessons to support different starting points.</p></div></article>
      </div>
    </section>

    <section className="anwaar-curriculum" id="curriculum" aria-labelledby="curriculum-title">
      <div className="anwaar-section-head" data-reveal><p className="anwaar-kicker">Curriculum</p><h2 id="curriculum-title">Explore what you’ll study</h2></div>
      <div className="anwaar-explorer" data-reveal>
        <div className="anwaar-subject-tabs" role="tablist" aria-label="Subjects" onKeyDown={navigateSubjects}>
          {subjects.map((subject,index)=>{
            const Icon = subjectIcons[index];
            return <button key={subject} type="button" role="tab" id={'subject-tab-'+index} aria-selected={index===selectedSubject} aria-controls="subject-panel" tabIndex={index===selectedSubject?0:-1} onClick={()=>setSelectedSubject(index)} ref={element=>{subjectButtons.current[index]=element}}>
              <Icon size={18}/><span>{subject}</span><ChevronRight size={16}/>
            </button>;
          })}
        </div>
        <article className="anwaar-subject-detail" id="subject-panel" role="tabpanel" aria-labelledby={'subject-tab-'+selectedSubject} tabIndex={0}>
          <div key={selectedSubject} className="anwaar-subject-copy">
            <SubjectIcon className="anwaar-detail-motif" size={230} strokeWidth={.5} aria-hidden="true"/>
            <span className="anwaar-detail-icon"><SubjectIcon size={26}/></span>
            <h3>{subjects[selectedSubject]}</h3>
            <p>{descriptions[selectedSubject]}</p>
            <div className="anwaar-study-prompt"><span>Try this</span><p>{studyPrompts[selectedSubject]}</p></div>
          </div>
        </article>
      </div>
    </section>

    <section className="anwaar-enrol" id="enrolment" aria-labelledby="enrolment-title">
      <div className="anwaar-enrol-copy">
        <p className="anwaar-kicker">2027 registration</p><h2 id="enrolment-title">Find your class</h2>
        <p>Choose a weekly group class or arrange one-to-one lessons with the madressa.</p>
        <a className="anwaar-gold" href={enquiry} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Enquire on WhatsApp <ArrowUpRight size={16}/></a>
      </div>
      <div className="anwaar-class-options" data-reveal>
        <article><span className="anwaar-class-icon"><CalendarDays size={22}/></span><div><h3>Sunday group classes</h3><p>08:00–10:00 South African time</p></div></article>
        <article><span className="anwaar-class-icon"><Users size={22}/></span><div><h3>Private lessons</h3><p>One-to-one, in person or online. Times arranged individually.</p></div></article>
      </div>
    </section>

    <section className="anwaar-hubs" aria-labelledby="hubs-title">
      <div className="anwaar-section-head"><p className="anwaar-kicker">Learning platform</p><h2 id="hubs-title">Your madressa hubs</h2></div>
      <div className="anwaar-hub-grid" data-reveal>
        <article className="anwaar-student-card"><GraduationCap/><h3>Student hub</h3><p>Access your timetable, learning resources, assignments, feedback and progress.</p><button onClick={()=>enter('student')}>Open student hub <ArrowRight size={17}/></button></article>
        <article><LayoutDashboard/><h3>Teacher hub</h3><p>Manage enrolments, class schedules, assessments, attendance and outstanding fees.</p><button onClick={()=>enter('teacher')}>Open teacher hub <ArrowRight size={17}/></button></article>
      </div>
    </section>
  </main>;
}
