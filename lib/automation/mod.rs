pub mod auto_approve;
pub mod orchestration;

pub use auto_approve::{
    evaluate_auto_approve, execute_auto_approve, ApproveOutcome, AutoApproveCandidate,
    AutoApproveResult,
};
pub use orchestration::{
    execute_auto_approve_with_merge, ApproveWithMergeOutcome, AutoApproveWithMergeResult,
    AutoMergeStatus,
};
