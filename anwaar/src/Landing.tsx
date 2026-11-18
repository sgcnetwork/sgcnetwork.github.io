import React from 'react';
import {ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Compass, GraduationCap, Heart, History, LayoutDashboard, MessageCircle, Quote, Scale, Sparkles, Sun, Users} from 'lucide-react';
import {subjects} from './model';
import studyPhoto from './quraan-study.webp';

const descriptions = [
  'Build confidence in recitation and practise the rules of Tajweed.',
  'Learn supplications to use throughout your day.',
  'Understand the practical rulings that guide worship and daily life.',
  'Explore the people and events that shaped our Islamic heritage.',
  'Build a foundation in the core beliefs of Islam.',
  'Study the teachings of the Prophet ﷺ and reflect on how to live them.',
  'Make remembrance of Allah a regular part of your day.',
];

const subjectIcons = [BookOpen, Heart, Scale, History, Compass, Quote, Sparkles];

const enquiry = 'https://wa.me/27822114583?text=Assalaamu%20alaykum%2C%20I%20would%20like%20to%20enquire%20about%202027%20registration.';

export default function Landing({enter}:{enter:(view:string, demo?:boolean)=>void}) {
  return <main className="anwaar-landing" id="madressa">
    <section className="anwaar-hero" aria-labelledby="anwaar-title">
      <div className="anwaar-hero-copy">
        <div className="anwaar-kicker"><span/> Islamic learning for all</div>
        <p className="anwaar-arabic" lang="ar" dir="rtl">أنوار القرآن</p>
        <h1 id="anwaar-title"><span>Madressa</span> Anwaar Ul Quraan</h1>
        <p className="anwaar-lede">Our vision is to nurture a lifelong connection with the Quraan and help learners carry Islamic knowledge into everyday life.</p>
        <div className="anwaar-actions"><a className="anwaar-gold" href="#curriculum">Explore our classes <ArrowRight size={17}/></a><button className="anwaar-outline" onClick={()=>enter('student')}>Student hub <ArrowUpRight size={17}/></button></div>
      </div>
      <figure className="anwaar-visual">
        <div className="anwaar-photo"><img src={studyPhoto} alt="An open Quraan on a wooden stand beside a sunlit arched window" fetchPriority="high"/></div>
        <span className="anwaar-spark" aria-hidden="true">✧</span><span className="anwaar-spark anwaar-spark-small" aria-hidden="true">✦</span>
        <figcaption><Sun size={21}/> Adults, children and new Muslims welcome</figcaption>
      </figure>
    </section>

    <div className="anwaar-quick-links" aria-label="Explore the madressa">
      <a href="#curriculum"><BookOpen size={20}/> Explore the curriculum <ArrowUpRight size={15}/></a>
      <a href="#enrolment"><CalendarDays size={20}/> Find a class <ArrowUpRight size={15}/></a>
      <button onClick={()=>enter('student')}><GraduationCap size={21}/> Go to the Student Hub <ArrowUpRight size={15}/></button>
    </div>

    <section className="anwaar-mission" id="vision" aria-labelledby="vision-title">
      <div><p className="anwaar-kicker">Our vision &amp; aims</p><h2 id="vision-title">Learn with understanding.<br/><em>Live what you learn.</em></h2></div>
      <div className="anwaar-aims">
        <article><BookOpen/><div><h3>Read with confidence</h3><p>Help learners build confidence in reading the Quraan through guided recitation and Tajweed practice.</p></div></article>
        <article><Compass/><div><h3>Build Islamic foundations</h3><p>Help students understand the beliefs and practices that guide everyday Muslim life.</p></div></article>
        <article><Heart/><div><h3>Make room for every learner</h3><p>Welcome children, adults and new Muslims, with group and private lessons to support different starting points.</p></div></article>
      </div>
    </section>

    <section className="anwaar-curriculum" id="curriculum" aria-labelledby="curriculum-title">
      <div className="anwaar-section-head"><p className="anwaar-kicker">Curriculum</p><h2 id="curriculum-title">What you’ll study</h2></div>
      <div className="anwaar-subjects">{subjects.map((subject,index)=>{
        const Icon = subjectIcons[index];
        return <article key={subject}><span className="anwaar-icon"><Icon size={22}/></span><h3>{subject}</h3><p>{descriptions[index]}</p></article>;
      })}</div>
    </section>

    <section className="anwaar-enrol" id="enrolment" aria-labelledby="enrolment-title">
      <div className="anwaar-enrol-copy">
        <p className="anwaar-kicker">2027 registration</p><h2 id="enrolment-title">Find your class</h2>
        <p>Choose a weekly group class or arrange one-to-one lessons with the madressa.</p>
        <a className="anwaar-gold" href={enquiry} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Enquire on WhatsApp <ArrowUpRight size={16}/></a>
      </div>
      <div className="anwaar-class-options">
        <article><span className="anwaar-class-icon"><CalendarDays size={22}/></span><div><h3>Sunday group classes</h3><p>08:00–10:00 South African time</p></div></article>
        <article><span className="anwaar-class-icon"><Users size={22}/></span><div><h3>Private lessons</h3><p>One-to-one, in person or online. Times arranged individually.</p></div></article>
      </div>
    </section>

    <section className="anwaar-hubs" aria-labelledby="hubs-title">
      <div className="anwaar-section-head"><p className="anwaar-kicker">Learning platform</p><h2 id="hubs-title">Your madressa hubs</h2></div>
      <div className="anwaar-hub-grid">
        <article className="anwaar-student-card"><GraduationCap/><h3>Student hub</h3><p>Access your timetable, learning resources, assignments, feedback and progress.</p><button onClick={()=>enter('student')}>Open student hub <ArrowRight size={17}/></button></article>
        <article><LayoutDashboard/><h3>Teacher hub</h3><p>Manage enrolments, class schedules, assessments, attendance and outstanding fees.</p><button onClick={()=>enter('teacher')}>Open teacher hub <ArrowRight size={17}/></button></article>
      </div>
    </section>
  </main>;
}
