import { Department, MeetingConfig } from './types';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const MONTH_TO_MEETING_MAP: Record<Department, Record<number, MeetingConfig>> = {
  [Department.SALES]: {
    1: {
      head: "Value Proposition (Product:---- ) Customer Profile",
      subHeads: { d1: "Customer gains", d2: "Customer pains", d3: "Customer jobs" }
    },
    2: {
      head: "Value Proposition (Product:---- ) Value Map",
      subHeads: { d1: "Gain creator", d2: "Pain receiver", d3: "Products and services" }
    },
    3: {
      head: "Value Proposition (Product:---- ) Customer Product fit",
      subHeads: { d1: "Ranking & fit creation", d2: "Validation", d3: "Validation" }
    },
    4: {
      head: "Value Proposition (Product:---- ) Customer Profile",
      subHeads: { d1: "Customer gains", d2: "Customer pains", d3: "Customer jobs" }
    },
    5: {
      head: "Value Proposition (Product:---- ) Value Map",
      subHeads: { d1: "Gain creator", d2: "Pain receiver", d3: "Products and services" }
    },
    6: {
      head: "Value Proposition (Product:---- ) Customer Product fit",
      subHeads: { d1: "Ranking & fit creation", d2: "Validation", d3: "Validation" }
    },
    7: {
      head: "Value Proposition (Product:---- ) Customer Profile",
      subHeads: { d1: "Customer gains", d2: "Customer pains", d3: "Customer jobs" }
    },
    8: {
      head: "Value Proposition (Product:---- ) Value Map",
      subHeads: { d1: "Gain creator", d2: "Pain receiver", d3: "Products and services" }
    },
    9: {
      head: "Value Proposition (Product:---- ) Customer Product fit",
      subHeads: { d1: "Ranking & fit creation", d2: "Validation", d3: "Validation" }
    },
    10: {
      head: "Value Proposition (Product:---- ) Customer Profile",
      subHeads: { d1: "Customer gains", d2: "Customer pains", d3: "Customer jobs" }
    },
    11: {
      head: "Value Proposition (Product:---- ) Value Map",
      subHeads: { d1: "Gain creator", d2: "Pain receiver", d3: "Products and services" }
    },
    12: {
      head: "Value Proposition (Product:---- ) Customer Product fit",
      subHeads: { d1: "Ranking & fit creation", d2: "Validation", d3: "Validation" }
    }
  },
  [Department.MARKETING]: {
    1: {
      head: "Projected market reach plan (Product:---- ) forecast total target market demand",
      subHeads: { 
        d1: "Define market. Divide total industry demand", 
        d2: "Forecast demand drivers. Project drivers change", 
        d3: "Sensitivity analysis & quantification" 
      }
    },
    2: {
      head: "Projected market reach plan (Product:---- ) smart goal setting",
      subHeads: { d1: "Data gathering", d2: "Number working", d3: "Goal list" }
    },
    3: {
      head: "Projected market reach plan (Product:---- ) goal catching",
      subHeads: { d1: "Channel analysis", d2: "Final alternatives. Channel selection", d3: "Reach plan" }
    },
    4: {
      head: "Projected market reach plan (Product:---- ) forecast total target market demand",
      subHeads: { 
        d1: "Define market. Divide total industry demand", 
        d2: "Forecast demand drivers. Project drivers change", 
        d3: "Sensitivity analysis & quantification" 
      }
    },
    5: {
      head: "Projected market reach plan (Product:---- ) smart goal setting",
      subHeads: { d1: "Data gathering", d2: "Number working", d3: "Goal list" }
    },
    6: {
      head: "Projected market reach plan (Product:---- ) goal catching",
      subHeads: { d1: "Channel analysis", d2: "Final alternatives. Channel selection", d3: "Reach plan" }
    },
    7: {
      head: "Projected market reach plan (Product:---- ) forecast total target market demand",
      subHeads: { 
        d1: "Define market. Divide total industry demand", 
        d2: "Forecast demand drivers. Project drivers change", 
        d3: "Sensitivity analysis & quantification" 
      }
    },
    8: {
      head: "Projected market reach plan (Product:---- ) smart goal setting",
      subHeads: { d1: "Data gathering", d2: "Number working", d3: "Goal list" }
    },
    9: {
      head: "Projected market reach plan (Product:---- ) goal catching",
      subHeads: { d1: "Channel analysis", d2: "Final alternatives. Channel selection", d3: "Reach plan" }
    },
    10: {
      head: "Projected market reach plan (Product:---- ) forecast total target market demand",
      subHeads: { 
        d1: "Define market. Divide total industry demand", 
        d2: "Forecast demand drivers. Project drivers change", 
        d3: "Sensitivity analysis & quantification" 
      }
    },
    11: {
      head: "Projected market reach plan (Product:---- ) smart goal setting",
      subHeads: { d1: "Data gathering", d2: "Number working", d3: "Goal list" }
    },
    12: {
      head: "Projected market reach plan (Product:---- ) goal catching",
      subHeads: { d1: "Channel analysis", d2: "Final alternatives. Channel selection", d3: "Reach plan" }
    }
  },
  [Department.PRODUCTION]: {
    1: {
      head: "factory planning & Equipment layout (Product:---- ) Factory planning",
      subHeads: { d1: "5W1H as per strategic plan", d2: "Budget provision.HR provision", d3: "Timeline" }
    },
    2: {
      head: "factory planning & Equipment layout (Product:---- ) Equipment plan",
      subHeads: { d1: "5W1H as per factory plan", d2: "Budget distribution", d3: "Timeline" }
    },
    3: {
      head: "factory planning & Equipment layout (Product:---- ) Layout plan",
      subHeads: { d1: "5W1H as per factory & Equipment plan", d2: "Layout plan creation", d3: "Factory establishment timeline" }
    },
    4: {
      head: "factory planning & Equipment layout (Product:---- ) Factory planning",
      subHeads: { d1: "5W1H as per strategic plan", d2: "Budget provision.HR provision", d3: "Timeline" }
    },
    5: {
      head: "factory planning & Equipment layout (Product:---- ) Equipment plan",
      subHeads: { d1: "5W1H as per factory plan", d2: "Budget distribution", d3: "Timeline" }
    },
    6: {
      head: "factory planning & Equipment layout (Product:---- ) Layout plan",
      subHeads: { d1: "5W1H as per factory & Equipment plan", d2: "Layout plan creation", d3: "Factory establishment timeline" }
    },
    7: {
      head: "factory planning & Equipment layout (Product:---- ) Factory planning",
      subHeads: { d1: "5W1H as per strategic plan", d2: "Budget provision.HR provision", d3: "Timeline" }
    },
    8: {
      head: "factory planning & Equipment layout (Product:---- ) Equipment plan",
      subHeads: { d1: "5W1H as per factory plan", d2: "Budget distribution", d3: "Timeline" }
    },
    9: {
      head: "factory planning & Equipment layout (Product:---- ) Layout plan",
      subHeads: { d1: "5W1H as per factory & Equipment plan", d2: "Layout plan creation", d3: "Factory establishment timeline" }
    },
    10: {
      head: "factory planning & Equipment layout (Product:---- ) Factory planning",
      subHeads: { d1: "5W1H as per strategic plan", d2: "Budget provision.HR provision", d3: "Timeline" }
    },
    11: {
      head: "factory planning & Equipment layout (Product:---- ) Equipment plan",
      subHeads: { d1: "5W1H as per factory plan", d2: "Budget distribution", d3: "Timeline" }
    },
    12: {
      head: "factory planning & Equipment layout (Product:---- ) Layout plan",
      subHeads: { d1: "5W1H as per factory & Equipment plan", d2: "Layout plan creation", d3: "Factory establishment timeline" }
    }
  },
  [Department.VIGIL]: {
    1: {
        head: "Edge creation over competition (Product:---- ) Price",
        subHeads: { d1: "Competitive prices & offering against ours", d2: "Different models to try", d3: "Our price edge strategy" }
    },
    2: {
        head: "Edge creation over competition (Product:---- ) Packaging",
        subHeads: { d1: "Competitive packaging against ours", d2: "Different models to try", d3: "Our packaging edge strategy" }
    },
    3: {
        head: "Edge creation over competition (Product:---- ) Performance",
        subHeads: { d1: "Competitive performance against ours", d2: "Different models to try", d3: "Our performance edge strategy" }
    },
    4: {
        head: "Edge creation over competition (Product:---- ) Price",
        subHeads: { d1: "Competitive prices & offering against ours", d2: "Different models to try", d3: "Our price edge strategy" }
    },
    5: {
        head: "Edge creation over competition (Product:---- ) Packaging",
        subHeads: { d1: "Competitive packaging against ours", d2: "Different models to try", d3: "Our packaging edge strategy" }
    },
    6: {
        head: "Edge creation over competition (Product:---- ) Performance",
        subHeads: { d1: "Competitive performance against ours", d2: "Different models to try", d3: "Our performance edge strategy" }
    },
    7: {
        head: "Edge creation over competition (Product:---- ) Price",
        subHeads: { d1: "Competitive prices & offering against ours", d2: "Different models to try", d3: "Our price edge strategy" }
    },
    8: {
        head: "Edge creation over competition (Product:---- ) Packaging",
        subHeads: { d1: "Competitive packaging against ours", d2: "Different models to try", d3: "Our packaging edge strategy" }
    },
    9: {
        head: "Edge creation over competition (Product:---- ) Performance",
        subHeads: { d1: "Competitive performance against ours", d2: "Different models to try", d3: "Our performance edge strategy" }
    },
    10: {
        head: "Edge creation over competition (Product:---- ) Price",
        subHeads: { d1: "Competitive prices & offering against ours", d2: "Different models to try", d3: "Our price edge strategy" }
    },
    11: {
        head: "Edge creation over competition (Product:---- ) Packaging",
        subHeads: { d1: "Competitive packaging against ours", d2: "Different models to try", d3: "Our packaging edge strategy" }
    },
    12: {
        head: "Edge creation over competition (Product:---- ) Performance",
        subHeads: { d1: "Competitive performance against ours", d2: "Different models to try", d3: "Our performance edge strategy" }
    }
  },
  [Department.HR]: {
    1: { head: "Employee related: Recruitment /Exit", subHeads: { d1: "Demand & Confirmation", d2: "List plan", d3: "Execution" } },
    2: { head: "Employee related: Retention", subHeads: { d1: "Activities. Improvement plan entries", d2: "Communication", d3: "Decision" } },
    3: { head: "Employee related: Performance & Appraisal", subHeads: { d1: "Analysis", d2: "List and decision", d3: "Execution.Salary.Increment" } },
    4: { head: "Employee related: Recruitment /Exit", subHeads: { d1: "Demand & Confirmation", d2: "List plan", d3: "Execution" } },
    5: { head: "Employee related: Retention", subHeads: { d1: "Activities. Improvement plan entries", d2: "Communication", d3: "Decision" } },
    6: { head: "Employee related: Performance & Appraisal", subHeads: { d1: "Analysis", d2: "List and decision", d3: "Execution.Salary.Increment" } },
    7: { head: "Employee related: Recruitment /Exit", subHeads: { d1: "Demand & Confirmation", d2: "List plan", d3: "Execution" } },
    8: { head: "Employee related: Retention", subHeads: { d1: "Activities. Improvement plan entries", d2: "Communication", d3: "Decision" } },
    9: { head: "Employee related: Performance & Appraisal", subHeads: { d1: "Analysis", d2: "List and decision", d3: "Execution.Salary.Increment" } },
    10: { head: "Employee related: Recruitment /Exit", subHeads: { d1: "Demand & Confirmation", d2: "List plan", d3: "Execution" } },
    11: { head: "Employee related: Retention", subHeads: { d1: "Activities. Improvement plan entries", d2: "Communication", d3: "Decision" } },
    12: { head: "Employee related: Performance & Appraisal", subHeads: { d1: "Analysis", d2: "List and decision", d3: "Execution.Salary.Increment" } }
  },
  [Department.R_AND_D]: { 
    1: { head: "New product designing (Vigil based)", subHeads: { d1: "Product definition", d2: "Step process", d3: "Comparison" } },
    2: { head: "New product designing (Vigil based)", subHeads: { d1: "Product definition", d2: "Step process", d3: "Comparison" } },
    3: { head: "New product designing (Vigil based)", subHeads: { d1: "Product definition", d2: "Step process", d3: "Comparison" } },
    4: { head: "New product designing (Vigil based)", subHeads: { d1: "Product definition", d2: "Step process", d3: "Comparison" } },
    5: { head: "New product designing (Vigil based)", subHeads: { d1: "Product definition", d2: "Step process", d3: "Comparison" } },
    6: { head: "New product designing (Vigil based)", subHeads: { d1: "Product definition", d2: "Step process", d3: "Comparison" } },
    7: { head: "New product designing (Vigil based)", subHeads: { d1: "Product definition", d2: "Step process", d3: "Comparison" } },
    8: { head: "New product designing (Vigil based)", subHeads: { d1: "Product definition", d2: "Step process", d3: "Comparison" } },
    9: { head: "New product designing (Vigil based)", subHeads: { d1: "Product definition", d2: "Step process", d3: "Comparison" } },
    10: { head: "New product designing (Vigil based)", subHeads: { d1: "Product definition", d2: "Step process", d3: "Comparison" } },
    11: { head: "New product designing (Vigil based)", subHeads: { d1: "Product definition", d2: "Step process", d3: "Comparison" } },
    12: { head: "New product designing (Vigil based)", subHeads: { d1: "Product definition", d2: "Step process", d3: "Comparison" } }
  },
  [Department.NPC]: { 
    1: { head: "Creating Product: Early pipeline", subHeads: { d1: "Level 4.2D", d2: "Level 5.3D", d3: "Level 6.3D product" } },
    2: { head: "Creating Product: Early pipeline", subHeads: { d1: "Level 4.2D", d2: "Level 5.3D", d3: "Level 6.3D product" } },
    3: { head: "Creating Product: Early pipeline", subHeads: { d1: "Level 4.2D", d2: "Level 5.3D", d3: "Level 6.3D product" } },
    4: { head: "Creating Product: Early pipeline", subHeads: { d1: "Level 4.2D", d2: "Level 5.3D", d3: "Level 6.3D product" } },
    5: { head: "Creating Product: Early pipeline", subHeads: { d1: "Level 4.2D", d2: "Level 5.3D", d3: "Level 6.3D product" } },
    6: { head: "Creating Product: Early pipeline", subHeads: { d1: "Level 4.2D", d2: "Level 5.3D", d3: "Level 6.3D product" } },
    7: { head: "Creating Product: Early pipeline", subHeads: { d1: "Level 4.2D", d2: "Level 5.3D", d3: "Level 6.3D product" } },
    8: { head: "Creating Product: Early pipeline", subHeads: { d1: "Level 4.2D", d2: "Level 5.3D", d3: "Level 6.3D product" } },
    9: { head: "Creating Product: Early pipeline", subHeads: { d1: "Level 4.2D", d2: "Level 5.3D", d3: "Level 6.3D product" } },
    10: { head: "Creating Product: Early pipeline", subHeads: { d1: "Level 4.2D", d2: "Level 5.3D", d3: "Level 6.3D product" } },
    11: { head: "Creating Product: Early pipeline", subHeads: { d1: "Level 4.2D", d2: "Level 5.3D", d3: "Level 6.3D product" } },
    12: { head: "Creating Product: Early pipeline", subHeads: { d1: "Level 4.2D", d2: "Level 5.3D", d3: "Level 6.3D product" } }
  },
  [Department.BUSINESS_STRATEGY]: { 
    1: { head: "BS for new product: Market study", subHeads: { d1: "Customer & trend", d2: "SWOT", d3: "Value proposition" } },
    2: { head: "BS for new product: Market study", subHeads: { d1: "Customer & trend", d2: "SWOT", d3: "Value proposition" } },
    3: { head: "BS for new product: Market study", subHeads: { d1: "Customer & trend", d2: "SWOT", d3: "Value proposition" } },
    4: { head: "BS for new product: Market study", subHeads: { d1: "Customer & trend", d2: "SWOT", d3: "Value proposition" } },
    5: { head: "BS for new product: Market study", subHeads: { d1: "Customer & trend", d2: "SWOT", d3: "Value proposition" } },
    6: { head: "BS for new product: Market study", subHeads: { d1: "Customer & trend", d2: "SWOT", d3: "Value proposition" } },
    7: { head: "BS for new product: Market study", subHeads: { d1: "Customer & trend", d2: "SWOT", d3: "Value proposition" } },
    8: { head: "BS for new product: Market study", subHeads: { d1: "Customer & trend", d2: "SWOT", d3: "Value proposition" } },
    9: { head: "BS for new product: Market study", subHeads: { d1: "Customer & trend", d2: "SWOT", d3: "Value proposition" } },
    10: { head: "BS for new product: Market study", subHeads: { d1: "Customer & trend", d2: "SWOT", d3: "Value proposition" } },
    11: { head: "BS for new product: Market study", subHeads: { d1: "Customer & trend", d2: "SWOT", d3: "Value proposition" } },
    12: { head: "BS for new product: Market study", subHeads: { d1: "Customer & trend", d2: "SWOT", d3: "Value proposition" } }
  },
  [Department.ACCOUNT_FINANCE]: { 
    1: { head: "Budget: Previous quarter outcome", subHeads: { d1: "Budget utilized", d2: "Capital output", d3: "P&L Sheet" } },
    2: { head: "Budget: Previous quarter outcome", subHeads: { d1: "Budget utilized", d2: "Capital output", d3: "P&L Sheet" } },
    3: { head: "Budget: Previous quarter outcome", subHeads: { d1: "Budget utilized", d2: "Capital output", d3: "P&L Sheet" } },
    4: { head: "Budget: Previous quarter outcome", subHeads: { d1: "Budget utilized", d2: "Capital output", d3: "P&L Sheet" } },
    5: { head: "Budget: Previous quarter outcome", subHeads: { d1: "Budget utilized", d2: "Capital output", d3: "P&L Sheet" } },
    6: { head: "Budget: Previous quarter outcome", subHeads: { d1: "Budget utilized", d2: "Capital output", d3: "P&L Sheet" } },
    7: { head: "Budget: Previous quarter outcome", subHeads: { d1: "Budget utilized", d2: "Capital output", d3: "P&L Sheet" } },
    8: { head: "Budget: Previous quarter outcome", subHeads: { d1: "Budget utilized", d2: "Capital output", d3: "P&L Sheet" } },
    9: { head: "Budget: Previous quarter outcome", subHeads: { d1: "Budget utilized", d2: "Capital output", d3: "P&L Sheet" } },
    10: { head: "Budget: Previous quarter outcome", subHeads: { d1: "Budget utilized", d2: "Capital output", d3: "P&L Sheet" } },
    11: { head: "Budget: Previous quarter outcome", subHeads: { d1: "Budget utilized", d2: "Capital output", d3: "P&L Sheet" } },
    12: { head: "Budget: Previous quarter outcome", subHeads: { d1: "Budget utilized", d2: "Capital output", d3: "P&L Sheet" } }
  },
  [Department.PURCHASE]: { 
    1: { head: "Asset Quotation: Asset hunting", subHeads: { d1: "Survey", d2: "Shortlist", d3: "Decision" } },
    2: { head: "Asset Quotation: Asset hunting", subHeads: { d1: "Survey", d2: "Shortlist", d3: "Decision" } },
    3: { head: "Asset Quotation: Asset hunting", subHeads: { d1: "Survey", d2: "Shortlist", d3: "Decision" } },
    4: { head: "Asset Quotation: Asset hunting", subHeads: { d1: "Survey", d2: "Shortlist", d3: "Decision" } },
    5: { head: "Asset Quotation: Asset hunting", subHeads: { d1: "Survey", d2: "Shortlist", d3: "Decision" } },
    6: { head: "Asset Quotation: Asset hunting", subHeads: { d1: "Survey", d2: "Shortlist", d3: "Decision" } },
    7: { head: "Asset Quotation: Asset hunting", subHeads: { d1: "Survey", d2: "Shortlist", d3: "Decision" } },
    8: { head: "Asset Quotation: Asset hunting", subHeads: { d1: "Survey", d2: "Shortlist", d3: "Decision" } },
    9: { head: "Asset Quotation: Asset hunting", subHeads: { d1: "Survey", d2: "Shortlist", d3: "Decision" } },
    10: { head: "Asset Quotation: Asset hunting", subHeads: { d1: "Survey", d2: "Shortlist", d3: "Decision" } },
    11: { head: "Asset Quotation: Asset hunting", subHeads: { d1: "Survey", d2: "Shortlist", d3: "Decision" } },
    12: { head: "Asset Quotation: Asset hunting", subHeads: { d1: "Survey", d2: "Shortlist", d3: "Decision" } }
  },
  [Department.LEGAL]: { 
    1: { head: "Govt & official documentation: Certification", subHeads: { d1: "New", d2: "Renewal", d3: "Future" } },
    2: { head: "Govt & official documentation: Certification", subHeads: { d1: "New", d2: "Renewal", d3: "Future" } },
    3: { head: "Govt & official documentation: Certification", subHeads: { d1: "New", d2: "Renewal", d3: "Future" } },
    4: { head: "Govt & official documentation: Certification", subHeads: { d1: "New", d2: "Renewal", d3: "Future" } },
    5: { head: "Govt & official documentation: Certification", subHeads: { d1: "New", d2: "Renewal", d3: "Future" } },
    6: { head: "Govt & official documentation: Certification", subHeads: { d1: "New", d2: "Renewal", d3: "Future" } },
    7: { head: "Govt & official documentation: Certification", subHeads: { d1: "New", d2: "Renewal", d3: "Future" } },
    8: { head: "Govt & official documentation: Certification", subHeads: { d1: "New", d2: "Renewal", d3: "Future" } },
    9: { head: "Govt & official documentation: Certification", subHeads: { d1: "New", d2: "Renewal", d3: "Future" } },
    10: { head: "Govt & official documentation: Certification", subHeads: { d1: "New", d2: "Renewal", d3: "Future" } },
    11: { head: "Govt & official documentation: Certification", subHeads: { d1: "New", d2: "Renewal", d3: "Future" } },
    12: { head: "Govt & official documentation: Certification", subHeads: { d1: "New", d2: "Renewal", d3: "Future" } }
  },
};
