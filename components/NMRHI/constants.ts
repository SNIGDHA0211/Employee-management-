import { StrategyCategory } from './types';

export const STRATEGY_CATEGORIES: StrategyCategory[] = [
  {
    id: 'nmrhi-npd',
    name: 'N',
    fullName: 'NPD - New Product Development',
    description: 'Strategic framework for developing new products, from ideation to market launch.',
    sections: [
      {
        title: 'Market Research',
        points: [
          'Identify emerging market trends and opportunities',
          'Analyze competitor strategies and positioning',
          'Define target customer segments and personas',
          'Evaluate market size and growth potential',
          'Assess regulatory and compliance requirements'
        ]
      },
      {
        title: 'Lead Generation',
        points: [
          'Develop inbound marketing strategies',
          'Build outbound prospecting campaigns',
          'Create referral and partnership programs',
          'Implement digital marketing initiatives',
          'Optimize conversion funnels'
        ]
      },
      {
        title: 'Sales Pipeline',
        points: [
          'Qualify leads effectively',
          'Develop compelling value propositions',
          'Create customized proposals and presentations',
          'Negotiate and close deals',
          'Ensure smooth customer onboarding'
        ]
      },
      {
        title: 'Revenue Growth',
        points: [
          'Upsell and cross-sell to existing customers',
          'Expand into new geographic markets',
          'Launch new products and services',
          'Build strategic partnerships',
          'Optimize pricing strategies'
        ]
      },
      {
        title: 'Performance Metrics',
        points: [
          'Track customer acquisition costs',
          'Monitor lifetime value metrics',
          'Measure conversion rates at each stage',
          'Analyze sales cycle duration',
          'Report on revenue growth trends'
        ]
      }
    ]
  },
  {
    id: 'nmrhi-mmr',
    name: 'M',
    fullName: 'MMR - Monthly Management Review',
    description: 'Comprehensive monthly review of management activities, performance metrics, and strategic alignment.',
    sections: [
      {
        title: 'Territory Planning',
        points: [
          'Define expansion priorities and timelines',
          'Assess infrastructure requirements',
          'Develop localization strategies',
          'Build distribution networks',
          'Establish local partnerships'
        ]
      },
      {
        title: 'Brand Positioning',
        points: [
          'Adapt messaging for local markets',
          'Build regional brand awareness',
          'Develop culturally relevant campaigns',
          'Establish thought leadership',
          'Create community engagement programs'
        ]
      },
      {
        title: 'Channel Development',
        points: [
          'Identify optimal sales channels',
          'Train and enable channel partners',
          'Implement channel conflict resolution',
          'Monitor channel performance',
          'Optimize channel mix'
        ]
      },
      {
        title: 'Customer Success',
        points: [
          'Establish local support capabilities',
          'Develop customer success playbooks',
          'Implement feedback mechanisms',
          'Build customer advocacy programs',
          'Reduce churn and improve retention'
        ]
      },
      {
        title: 'Growth Analytics',
        points: [
          'Track market penetration rates',
          'Monitor competitive positioning',
          'Measure brand awareness metrics',
          'Analyze customer satisfaction scores',
          'Report on expansion ROI'
        ]
      }
    ]
  },
  {
    id: 'nmrhi-rg',
    name: 'R',
    fullName: 'RG - Revenue Growth',
    description: 'Strategic initiatives for driving revenue growth through optimization and new opportunities.',
    sections: [
      {
        title: 'Workforce Planning',
        points: [
          'Assess current talent capabilities',
          'Identify skill gaps and training needs',
          'Develop succession planning',
          'Optimize team structures',
          'Implement performance management'
        ]
      },
      {
        title: 'Financial Management',
        points: [
          'Optimize budget allocation',
          'Reduce operational costs',
          'Improve cash flow management',
          'Implement financial controls',
          'Maximize return on investments'
        ]
      },
      {
        title: 'Process Improvement',
        points: [
          'Map and document key processes',
          'Identify bottlenecks and inefficiencies',
          'Implement automation solutions',
          'Standardize best practices',
          'Monitor process performance'
        ]
      },
      {
        title: 'Technology Enablement',
        points: [
          'Evaluate technology requirements',
          'Implement productivity tools',
          'Ensure data security and compliance',
          'Enable remote work capabilities',
          'Optimize IT infrastructure'
        ]
      },
      {
        title: 'Resource Metrics',
        points: [
          'Track employee productivity',
          'Monitor resource utilization rates',
          'Measure operational efficiency',
          'Analyze cost per unit metrics',
          'Report on improvement initiatives'
        ]
      }
    ]
  },
  {
    id: 'nmrhi-hc',
    name: 'H',
    fullName: 'HC - Human Capital',
    description: 'Investment in people through training, development, and creating a positive organizational culture.',
    sections: [
      {
        title: 'Talent Acquisition',
        points: [
          'Define employer brand strategy',
          'Optimize recruitment processes',
          'Build talent pipelines',
          'Implement structured interviews',
          'Ensure diversity and inclusion'
        ]
      },
      {
        title: 'Learning & Development',
        points: [
          'Create comprehensive training programs',
          'Develop leadership capabilities',
          'Implement mentoring initiatives',
          'Enable continuous learning culture',
          'Measure training effectiveness'
        ]
      },
      {
        title: 'Employee Engagement',
        points: [
          'Conduct regular engagement surveys',
          'Implement recognition programs',
          'Foster open communication',
          'Build team collaboration',
          'Address workplace concerns promptly'
        ]
      },
      {
        title: 'Career Development',
        points: [
          'Create clear career pathways',
          'Implement development plans',
          'Provide growth opportunities',
          'Enable internal mobility',
          'Support professional certifications'
        ]
      },
      {
        title: 'Culture & Values',
        points: [
          'Define and communicate core values',
          'Build inclusive work environment',
          'Promote work-life balance',
          'Celebrate achievements and milestones',
          'Foster innovation and creativity'
        ]
      }
    ]
  },
  {
    id: 'nmrhi-ip',
    name: 'I',
    fullName: 'IP - Innovation & Projects',
    description: 'Continuous pursuit of innovation and project execution to stay ahead of market trends and customer expectations.',
    sections: [
      {
        title: 'Product Innovation',
        points: [
          'Gather customer insights and feedback',
          'Research emerging technologies',
          'Prototype and test new concepts',
          'Launch minimum viable products',
          'Iterate based on market response'
        ]
      },
      {
        title: 'Process Innovation',
        points: [
          'Identify automation opportunities',
          'Implement agile methodologies',
          'Adopt lean principles',
          'Enable cross-functional collaboration',
          'Drive continuous improvement'
        ]
      },
      {
        title: 'Digital Transformation',
        points: [
          'Assess digital maturity',
          'Develop transformation roadmap',
          'Implement digital solutions',
          'Enable data-driven decisions',
          'Build digital capabilities'
        ]
      },
      {
        title: 'Research & Development',
        points: [
          'Invest in R&D initiatives',
          'Partner with research institutions',
          'Protect intellectual property',
          'Explore adjacent markets',
          'Build innovation labs'
        ]
      },
      {
        title: 'Innovation Metrics',
        points: [
          'Track idea generation and implementation',
          'Measure time to market',
          'Monitor innovation ROI',
          'Assess customer adoption rates',
          'Report on competitive advantage'
        ]
      }
    ]
  }
];
