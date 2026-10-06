insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,1,'Why SGC Starts Here','Part 1Why SGC Starts HereMany people start businesses backwards. They choose a name, design a logo, create social pages and build a website before they can clearly answer one basic question: Why should somebody pay me?Branding matters, but a polished brand cannot compensate for an unclear offer. SGC Academy begins with value: who you help, what is difficult for them, what changes after your solution, and what you actually implement.Throughout the Academy, your goal is not to finish videos. Your goal is to build something while you learn.','Write one sentence describing what you currently think your business would sell.',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=1);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,2,'The Internet Changed Information','Part 2The Internet Changed InformationA person can now learn the basics of websites, marketing, bookkeeping, design, content, AI, suppliers and pricing within minutes. Search engines, video platforms and AI have dramatically reduced the cost of accessing general information.This does not mean expertise has lost all value. It means a customer may no longer need you merely to tell them that something exists. Their challenge may be choosing, adapting and actually implementing the right solution.Information gives direction. Implementation creates movement.','Name three things you already know you should do, but have not consistently implemented. Why not?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=2);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,3,'Knowing Is Not the Same as Doing','Part 3Knowing Is Not the Same as DoingImagine a new entrepreneur searching for how to create a website. She quickly learns about domains, hosting, Shopify, WordPress, templates, SEO, payment gateways and analytics.She has information, but she still has decisions: Which platform fits her business? What pages are essential? How should checkout work? What payment provider is appropriate? How should mobile users experience the site?Her problem has shifted from access to information to implementation and decision-making.','Choose one unfinished task from the previous page. What exactly stopped you: time, confidence, confusion, too many options, lack of skill, or something else?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=3);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,4,'Why Customers Still Pay','Part 4Why Customers Still PayRecipes are free, yet restaurants exist. Canva exists, yet designers are hired. Website builders exist, yet developers are paid. Basic bookkeeping information exists, yet businesses hire professionals.Customers can pay for convenience, speed, expertise, customisation, accountability, execution, confidence, access, support, reduced risk and time saved.The important question is not simply, Can the customer find information? It is: What remains difficult after they find it?','For one business you use regularly, write what you are really paying for beyond the raw information or product.',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=4);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,5,'The Five Levels of Value','Part 5The Five Levels of ValueImplementation is not one thing. Customers want different amounts of help. Some want to learn independently; some want tools; some want guidance; some want to work alongside you; and some want the finished result.SGC uses five useful levels: Information → Tools → Guidance → Done With You → Done For You.None is automatically superior. The best level depends on the customer, price, complexity, risk and your ability to deliver.','What will you implement from this section?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=5);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,6,'Level 1: Information','Value LadderLevel 1: InformationInformation teaches the customer what to know or what to do. Examples include ebooks, guides, recorded lessons, checklists and tutorials.Example: Beginner''s Guide to Starting a Cleaning Business. The customer receives knowledge and remains responsible for implementation.Information can still be valuable when it is accurate, organised and saves research time. The mistake is assuming information alone always creates the result.','What information could you teach or organise for a customer?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=6);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,7,'Level 2: Tools','Value LadderLevel 2: ToolsTools reduce the effort required to act. Examples include templates, calculators, spreadsheets, scripts, prompt libraries, planners and content calendars.Instead of saying, ''Calculate your pricing,'' you might provide a pricing calculator that walks the customer through cost, markup and selling price.The customer still implements the solution, but the path becomes easier and more repeatable.','What template, checklist, calculator or system could make a task easier?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=7);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,8,'Level 3: Guidance','Value LadderLevel 3: GuidanceGuidance helps a customer apply general information to their specific circumstances. Examples include consultations, coaching, workshops, Q&A sessions and strategy sessions.A generic marketing guide might explain channels. A guidance offer might help the customer choose which channels make sense for their audience, budget and capacity.Customisation is part of the value.','What could you help a customer decide or understand?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=8);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,9,'Levels 4 & 5: Done With You / Done For You','Value LadderLevels 4 & 5: Done With You / Done For YouDone With You means you and the customer implement together. They learn while real progress is made. A website workshop, for example, could guide the customer through platform selection, pages, settings, payments and testing.Done For You means the customer pays you to implement most or all of the solution. Examples include building the website, setting up bookkeeping, automating reporting or producing a content system.Higher implementation usually increases responsibility and delivery complexity, so scope and competence matter.','Write one Done With You offer and one Done For You offer in the same niche.',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=9);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,10,'Build Your Implementation Ladder','ActivityBuild Your Implementation LadderChoose one topic you know about or are interested in. Create one possible offer at each of the five levels. Do not worry about perfect pricing yet.This exercise trains you to see that one area of knowledge can produce multiple offers depending on how much implementation you provide.','Information:
Tool:
Guidance:
Done With You:
Done For You:',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=10);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,11,'Stop Selling Tasks','Part 6Stop Selling TasksA task describes what you do. An outcome describes what becomes better for the customer because you did it.''I create spreadsheets'' is a task. ''I build automated tracking spreadsheets that help small businesses see sales, expenses and profit without recalculating everything each month'' communicates a more meaningful outcome.Customers often care less about the technical activity than the improvement it creates.','Write one task you could perform. Then rewrite it as the improvement the customer receives.',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=11);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,12,'Before → Implementation → After','Part 7Before → Implementation → AfterEvery useful offer creates movement. Before describes the customer''s current state. After describes the desired state. Implementation is the bridge.Example: Before - customer enquiries are scattered across WhatsApp, DMs and notes. After - enquiries are recorded in one organised system and followed up consistently. Implementation - set up a simple enquiry tracking workflow.The bridge is where your business can create value.','BEFORE: What is happening now?
AFTER: What should be different?
BRIDGE: What could you implement?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=12);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,13,'Implementation Is Not Only Services','Part 8Implementation Is Not Only ServicesProduct businesses can also improve implementation. A skincare company can sell products alone, or it can help customers identify goals, select products, understand order of use and build a routine.A gaming store can sell accessories, or create beginner bundles based on budget, compatibility and use case. A storage business can sell containers, or create a small-apartment organisation kit with labels, measurements and setup guidance.The physical product remains important; implementation makes successful use easier.','Choose a physical product. How could the business help the customer use it more successfully?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=13);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,14,'Specificity Creates Value','Part 9Specificity Creates Value''I help businesses grow'' is difficult to understand because it does not identify which businesses, what growth means, or how the result is created.Compare: ''I help small online retailers reduce time spent manually tracking orders by implementing a simple order-management workflow.''Specificity helps you define the customer, problem, result and implementation. It also makes marketing and delivery easier.','I help [WHO] achieve [RESULT] by [IMPLEMENTATION].',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=14);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,15,'Find the Implementation Gap','Part 10Find the Implementation GapAn implementation gap is the space between what someone knows they should do and what they have actually managed to do.Listen for phrases such as: ''I know I should...'', ''I don''t have time to...'', ''I hate doing...'', ''I don''t understand...'', ''I keep forgetting...'', ''There must be an easier way...'', and ''I tried, but...''.These phrases often reveal friction. Friction can reveal opportunities, although every problem still needs validation.','Write five frustrations you notice at work, home, online, in a hobby or in your community. Circle the two most interesting.',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=15);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,16,'Problem → Outcome → Solution → Tool','Part 11Problem → Outcome → Solution → ToolThe tool is not the solution. A customer may say they need AI, a website, TikTok or Excel. Your job is to ask what problem they are actually trying to solve.Good implementation thinking follows: Problem → Outcome → Solution → Tool. Starting with a fashionable tool and forcing it into the business often creates unnecessary complexity.Choose tools because they fit the problem, customer and operating reality.','Pick one: website / TikTok / AI / Excel. What underlying problem might make a customer ask for it? Could another tool solve the same problem?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=16);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,17,'Implementation Needs Scope','Part 12Implementation Needs ScopeBeing implementation-focused does not mean promising to handle everything. Good delivery defines what is included, what the customer must provide, what is excluded, when work starts and ends, and what results you can reasonably influence.A marketer can implement a campaign but cannot guarantee every viewer buys. A CV writer can improve a CV but cannot guarantee employment. A website developer can deliver a functioning store but cannot guarantee a specific revenue figure.You can usually control your output more directly than the customer''s ultimate outcome.','Write one output you can control and one outcome you can influence but cannot guarantee.',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=17);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,18,'Competence and Integrity','Part 13Competence and IntegrityDo not sell something you cannot competently deliver. AI can help with research, drafting, analysis, automation and learning, but it does not automatically make you a lawyer, accountant, adviser, developer or other specialist.If you identify an opportunity but lack the skill, learn it, practise, build samples, shadow someone, partner with a specialist or choose a different opportunity.Your reputation is an asset. Protect it by being clear about what you know and what you can deliver.','What would you need to learn or practise before charging for your idea?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=18);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,19,'AI and Implementation','Part 14AI and ImplementationAI makes generic information easier to generate. Instead of competing with AI on generic lists, consider how AI can help you implement a customised solution faster or better.A generic prompt can produce 20 marketing ideas for a bakery. Implementation considers the bakery''s location, audience, pricing, capacity, delivery radius, budget and previous performance, then turns that context into an appropriate plan and operating process.AI can be part of your delivery system without being your entire value proposition.','Where could AI assist your delivery without replacing your judgment or responsibility?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=19);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,20,'Learn → Apply → Implement → Review','The SGC MethodLearn → Apply → Implement → ReviewSGC Academy follows a repeating cycle: Learn → Apply → Implement → Review.You learn the concept, apply it to your business, implement a real change, then review what happened. Business rarely moves from idea to perfect execution. It moves through testing, feedback and adjustment.A failed test is not automatically wasted effort. A small test can protect you from a large, expensive mistake.','What could you measure to know whether your implementation actually worked?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=20);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,21,'Case Study: Thandi','PracticeCase Study: ThandiThandi enjoys Canva and originally says, ''I sell Canva designs.'' She notices new small businesses struggle with inconsistent social pages and do not know what to post.She creates a starter package: basic social direction, reusable templates, 10 customised posts, captions, a posting calendar and a short handover session.Her clearer statement becomes: I help new small businesses create a consistent professional social media presence by setting up their starter content system.','What was the task? What was the customer problem? What outcome did the customer want? What implementation increased the value?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=21);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,22,'Case Study: Kabelo & Lerato','PracticeCase Study: Kabelo & LeratoKabelo loves gaming. Instead of buying random inventory, he notices beginners struggle with compatibility, budgets and choosing equipment. He tests a beginner gaming setup planning service before expanding into products or affiliate offers.Lerato loves cooking. Instead of simply ''selling food'', she notices busy workers are too tired to cook after work. She tests weekly prepared dinner packs focused on convenience, planning and time.Both began with a customer situation rather than a product catalogue.','What implementation gap did Kabelo find? What implementation gap did Lerato find? Which idea would be cheaper to validate first, and why?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=22);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,23,'Your Implementation Audit','PracticalYour Implementation AuditNow bring the lesson together. List three skills you have, three things people ask you for help with, and three things you would be willing to learn.Then list three problems you notice people experiencing. Choose one and identify what information already exists, what still prevents action, and what could make implementation easier.','Skills / experience:
People ask me for help with:
Things I could learn:
Problems I notice:',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=23);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,24,'Your First SGC Implementation Statement','PracticalYour First SGC Implementation StatementUse your strongest idea from the audit. You are not committing to this business forever. You are creating a testable first draft.Complete the formula, then rewrite it in plain language that a stranger could understand in under 30 seconds.','I help __________________ achieve __________________ by __________________.

Plain-language version:',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=24);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,25,'Lesson 1 Review','FinishLesson 1 ReviewBefore moving on, you should be able to explain why information and implementation are different, identify the five levels of value, describe a customer before/after state, and point to at least one implementation gap.Your business idea does not need to be perfect yet. Lesson 2 will help you test whether the problem is real and worth solving.Instead of constantly asking, ''What can I sell?'', begin asking: ''What can I help someone actually achieve?''','What does selling implementation mean to you now? What is one thing you see differently after this lesson?',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=25);
insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,100,'Lesson 1 · Knowledge test','     SGC ACADEMY
      SGC ACADEMY • STUDENT ASSESSMENT




LESSON 1 KNOWLEDGE TEST
     10 questions • Recommended pass mark: 80%




        LEARN IT. APPLY IT. IMPLEMENT IT.

   ASSESSMENT

   Student Instructions
   Name: _______________________________________    Date: __________________

   Complete this assessment after the lesson. Recommended pass mark: 80%. Do not use the lesson while
   answering unless your facilitator has designated this as open-book.



   1. What is the main difference between
   information and implementation?
   A. Information is always free
   B. Implementation focuses on applying knowledge and creating action/results
   C. Implementation only applies to technology
   D. Information has no value




   2. Which example shows the highest
   implementation?
   A. A blog article about websites
   B. A website checklist
   C. A website strategy session
   D. Building and launching the customer website




   3. What is an implementation gap?
   A. Difference between cost and price
   B. Space between what someone knows they should do and what they have implemented
   C. A missing competitor
   D. A website error




SGC ACADEMY • MODULE 1 • LESSON 1                                                                       2

   4. Put the sequence in the correct order.
   Tool / Outcome / Problem / Solution




   5. Name the five levels of implementation value.




   6. Explain the difference between an output and an
   outcome.




   7. Why might a customer pay even when
   information is available free online?
   Give at least three reasons.




   8. Rewrite this task as an outcome-focused offer: “I
   create spreadsheets.”




SGC ACADEMY • MODULE 1 • LESSON 1                         3

   9. Complete the formula: I help ______ achieve ______
   by ______.




   10. Give one example of an implementation gap you
   have personally observed.




SGC ACADEMY • MODULE 1 • LESSON 1                          4

','Write your numbered answers below. Your facilitator will review your submission.',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=100);

insert into public.sgc_extra_lessons(module_no,position,title,body,prompt,published) select 1,101,'Lesson 1 · Practical implementation assessment','      SGC ACADEMY
      SGC ACADEMY • STUDENT ASSESSMENT




PRACTICAL IMPLEMENTATION
       ASSESSMENT
        Your first implementation opportunity




        LEARN IT. APPLY IT. IMPLEMENT IT.

   ASSESSMENT

   Student Instructions
   Name: _______________________________________      Date: __________________

   Complete this assessment after the lesson. Recommended pass mark: 80%. Do not use the lesson while
   answering unless your facilitator has designated this as open-book.



   1. Define the customer group you are observing.
   Be specific enough that you could realistically find and speak to these people.




   2. Describe the problem or friction you have
   observed.
   What is happening now? What is frustrating, slow, confusing, repetitive or difficult?




   3. Describe their current workaround.
   How are they dealing with the problem today?




   4. Explain why the current solution is not ideal.
   What does it cost them in time, money, effort, risk or frustration?




   5. Define the desired outcome.


SGC ACADEMY • MODULE 1 • LESSON 1                                                                       2

   What would “better” look like for the customer?




   6. Identify information already available to them.
   What could they already Google, watch or ask AI?




   7. Identify the implementation gap.
   What do they still struggle to actually do?




   8. Propose one implementation solution.
   What could you provide, set up, customise, guide or deliver?




   9. Choose the implementation level.
   Information / Tool / Guidance / Done With You / Done For You - explain your choice.




   10. Write your first SGC Implementation Statement.
   I help [WHO] achieve [RESULT] by [IMPLEMENTATION].




SGC ACADEMY • MODULE 1 • LESSON 1                                                        3

   11. Scope it responsibly.
   What can you deliver? What can you not guarantee? What would the customer need to provide?




   12. Reflection.
   What would you need to learn, test or validate before charging for this solution?




SGC ACADEMY • MODULE 1 • LESSON 1                                                               4

','Write your numbered answers below. Your facilitator will review your submission.',true where not exists(select 1 from public.sgc_extra_lessons where module_no=1 and position=101);
