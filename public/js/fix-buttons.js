// 等待页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 使用事件代理，监听所有动态生成的 .proposal-btn 点击
    document.addEventListener('click', function(e) {
        const target = e.target.closest('.proposal-btn');
        if (target) {
            e.stopPropagation(); // 阻止事件冒泡
            e.preventDefault();   // 阻止默认行为
            const materialId = target.dataset.materialId;
            if (materialId && typeof openProposalModal === 'function') {
                openProposalModal(parseInt(materialId));
            } else {
                console.error('Material ID not found or openProposalModal is not defined');
            }
        }
    });
    console.log('✅ 修复脚本已加载: 提议修改按钮已通过事件代理绑定');
});
