'use strict';

const DEMAND_TEMPLATES = {
  software_engineer: {
    role_type: 'software_engineer',
    role_label: 'Software Engineer',
    title: 'Software Engineer',
    description:
      'Seeking a Software Engineer to design, develop, and maintain software systems. ' +
      'Responsibilities include writing clean, maintainable code, participating in code reviews, ' +
      'collaborating with cross-functional teams, and contributing to architecture decisions.',
    required_skills: 'Programming languages (Python, Java, C++, or similar), ' +
      'software design patterns, version control (Git), unit testing, Agile/Scrum',
    priority: 'normal',
    clearance_required: 'None',
  },
  systems_engineer: {
    role_type: 'systems_engineer',
    role_label: 'Systems Engineer',
    title: 'Systems Engineer',
    description:
      'Seeking a Systems Engineer to define system requirements, develop system architectures, ' +
      'and manage technical interfaces across complex systems. Responsibilities include ' +
      'requirements analysis, interface control, verification and validation planning, and ' +
      'system integration support.',
    required_skills: 'Requirements management (DOORS or similar), systems modeling (SysML/UML), ' +
      'interface definition, test planning, MBSE, Agile/Scrum',
    priority: 'normal',
    clearance_required: 'None',
  },
  devops_engineer: {
    role_type: 'devops_engineer',
    role_label: 'DevOps Engineer',
    title: 'DevOps Engineer',
    description:
      'Seeking a DevOps Engineer to build and maintain CI/CD pipelines, automate infrastructure, ' +
      'and ensure reliable software delivery. Responsibilities include managing cloud infrastructure, ' +
      'container orchestration, monitoring, and enabling development team productivity.',
    required_skills: 'CI/CD pipelines (Jenkins, GitHub Actions, or similar), ' +
      'containerization (Docker, Kubernetes), cloud platforms (AWS, Azure, or GCP), ' +
      'infrastructure as code (Terraform, Ansible), scripting (Bash, Python)',
    priority: 'normal',
    clearance_required: 'None',
  },
  cyber_engineer: {
    role_type: 'cyber_engineer',
    role_label: 'Cyber Engineer',
    title: 'Cyber Engineer',
    description:
      'Seeking a Cyber Engineer to design, implement, and assess cybersecurity measures across ' +
      'systems and networks. Responsibilities include threat modeling, vulnerability assessment, ' +
      'security architecture design, penetration testing, and RMF/ATO activities.',
    required_skills: 'Cybersecurity frameworks (NIST, RMF, DISA STIGs), ' +
      'penetration testing tools, network security, encryption, security assessment and authorization (SA&A)',
    priority: 'normal',
    clearance_required: 'Secret',
  },
  chief_engineer: {
    role_type: 'chief_engineer',
    role_label: 'Chief Engineer',
    title: 'Chief Engineer',
    description:
      'Seeking a Chief Engineer to provide technical leadership and oversight for a complex program. ' +
      'Responsibilities include defining the technical vision, maintaining the system architecture, ' +
      'resolving technical risks, mentoring engineers, and interfacing with program management and customers.',
    required_skills: 'Broad technical expertise across multiple engineering disciplines, ' +
      'program leadership, architecture design, risk management, earned value management (EVM), ' +
      'stakeholder communication',
    priority: 'normal',
    clearance_required: 'None',
  },
  tester: {
    role_type: 'tester',
    role_label: 'Tester',
    title: 'Tester / Test Engineer',
    description:
      'Seeking a Tester to plan, develop, and execute test cases to validate system and software ' +
      'functionality. Responsibilities include test planning, test case development, defect reporting, ' +
      'regression testing, and verification and validation (V&V) activities.',
    required_skills: 'Test planning, test case development, defect tracking tools, ' +
      'automated testing frameworks, verification & validation (V&V), test reporting',
    priority: 'normal',
    clearance_required: 'None',
  },
  integrator: {
    role_type: 'integrator',
    role_label: 'Integrator',
    title: 'Systems Integrator',
    description:
      'Seeking a Systems Integrator to oversee the integration of hardware and software components ' +
      'into a cohesive system. Responsibilities include integration planning, interface verification, ' +
      'lab setup and management, integration testing, and issue root cause analysis.',
    required_skills: 'System integration, interface control, lab management, ' +
      'hardware/software integration, troubleshooting, test equipment operation',
    priority: 'normal',
    clearance_required: 'None',
  },
};

const ROLE_TYPES = Object.keys(DEMAND_TEMPLATES);

const ROLE_LABELS = Object.fromEntries(
  Object.entries(DEMAND_TEMPLATES).map(([key, val]) => [key, val.role_label])
);

module.exports = { DEMAND_TEMPLATES, ROLE_TYPES, ROLE_LABELS };
