export enum JobRole {
  MARKETING = 'Marketing Executive',
  SDE_INTERN = 'Software Development Intern',
  SDE_JOB = 'Software Developer (Full Time)',
  CYBER_SECURITY = 'Senior Cybersecurity Engineer',
  SECURE_DEV = 'Secure Software Developer',
  DEVSECOPS = 'DevSecOps Engineer',
  UI_UX_INTERN = 'UI/UX Designer Intern',
  IT_SALES_INTERN = 'IT Sales Intern'
}

export enum Language {
  ENGLISH = 'English',
  HINDI = 'Hindi',
  BENGALI = 'Bengali'
}

export interface InterviewConfig {
  name: string;
  role: JobRole;
  language: Language;
}

export interface TranscriptEntry {
  speaker: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface InterviewResult {
  passed: boolean;
  notes?: string;
  transcript: TranscriptEntry[];
  videoBlob?: Blob;
}

export const JOB_DESCRIPTIONS: Record<JobRole, string> = {
  [JobRole.MARKETING]: "Target Profile: A dynamic Marketing Executive. \nKey Skills: Digital marketing (SEO, SEM, PPC), Content Strategy, Social Media Management (LinkedIn, Twitter, Instagram), Brand Positioning, Market Research, and Crisis Communication. \nScenario: Ask about handling a PR crisis on social media, or how they would launch a product with zero budget. \nTrait: Look for high energy, persuasive communication, and data-driven creativity.",
  [JobRole.SDE_INTERN]: "Target Profile: Smart, eager-to-learn Software Development Intern. \nKey Skills: Data Structures & Algorithms (Arrays, Linked Lists, Trees), OOPs concepts (Polymorphism, Inheritance), Basic Web Dev (HTML/CSS/JS), Database basics (SQL). \nScenario: Ask how to reverse a linked list, or explain the difference between a process and a thread. \nTrait: Look for problem-solving aptitude (not just right answers) and eagerness to learn.",
  [JobRole.SDE_JOB]: "Target Profile: Experienced Full Stack Developer. \nKey Skills: System Design (Scalability, Load Balancing), Backend (Node.js/Express, Microservices), Frontend (React.js, State Management, SSR), Cloud (AWS/Docker/Kubernetes), and CI/CD pipelines. \nScenario: Ask to design a URL shortener system or handle database migration with zero downtime. \nTrait: Look for architectural depth, coding standards, and experience with production issues.",
  [JobRole.CYBER_SECURITY]: "Target Profile: Senior Cybersecurity Engineer. \nKey Skills: Security frameworks (OWASP, NIST), Penetration testing, Vulnerability assessment, Cryptography, Secure coding, Incident response. \nScenario: Ask to design a secure architecture for a banking app or handle a ransomware attack scenario. \nTrait: Look for deep technical knowledge, strategic thinking, and calm under pressure. \nRequirements: 5+ years experience, CISSP/CEH/OSCP preferred.",
  [JobRole.SECURE_DEV]: "Target Profile: Secure Software Developer. \nKey Skills: Secure coding practices, React/Node.js, Web security (XSS, CSRF, SQLi), Secure auth/authz, DevSecOps tools. \nScenario: Ask how to prevent XSS in a React app or secure a Node.js API against brute force attacks. \nTrait: Look for a security-first mindset in development choices. \nRequirements: 4+ years experience in secure software development.",
  [JobRole.DEVSECOPS]: "Target Profile: DevSecOps Engineer. \nKey Skills: CI/CD security, AWS/Azure security, Container security, IaC (Terraform), SAST/DAST tools. \nScenario: Ask how to integrate security scanning into a Jenkins pipeline or secure a Kubernetes cluster. \nTrait: Look for automation skills and ability to bridge dev, ops, and security. \nRequirements: 3+ years experience in DevOps with security focus.",
  [JobRole.UI_UX_INTERN]: "Target Profile: Creative UI/UX Designer Intern. \nKey Skills: Figma, Wireframing, Prototyping, User Research, Mobile & Web Design Principles, Color Theory, Typography. \nScenario: Ask them to walk through their design process for a mobile app or how they handle user feedback on a design. \nTrait: Look for creativity, empathy for the user, and attention to detail. \nResponsibilities: Designing website and mobile application interfaces under senior guidance.",
  [JobRole.IT_SALES_INTERN]: "Target Profile: Ambitious IT Sales Intern. \nKey Skills: Lead Generation, Technical Sales (SaaS, Cybersecurity), Client Communication, Negotiation, CRM tools, Understanding of Software Development Lifecycle. \nScenario: Ask how they would pitch a cybersecurity service to a non-technical CEO or handle a client objection about price. \nTrait: Look for confidence, persistence, and ability to explain technical concepts simply. \nResponsibilities: Selling technical services like software development and cyber security."
};