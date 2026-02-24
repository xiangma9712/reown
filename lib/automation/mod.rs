pub mod auto_approve;

pub use auto_approve::{
    AutoApproveCandidate, AutoApproveResult, ApproveOutcome, evaluate_auto_approve,
    execute_auto_approve,
};
