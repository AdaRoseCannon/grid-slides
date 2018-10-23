import GridSlidesController from '../grid-slides-controller.js';

GridSlidesController.registerTransition('slide-right',
	[{
		transform: 'translateX(-100vw)',
		opacity: 0
	},{
		transform: 'translateX(0)',
		opacity: 1
	}],
	{
		duration: 500,
		easing: getComputedStyle(document.documentElement).getPropertyValue('--easeInOutQuart')
	}
);

GridSlidesController.registerTransition('slide-left',
	[{
		transform: 'translateX(100vw)',
		opacity: 0
	},{
		transform: 'translateX(0)',
		opacity: 1
	}],
	{
		duration: 500,
		easing: getComputedStyle(document.documentElement).getPropertyValue('--easeInOutQuart')
	}
);

GridSlidesController.registerTransition('slide-down',
	[{
		transform: 'translateY(-100vh)'
	},{
		transform: 'translateY(0)'
	}],
	{
		duration: 500,
		easing: getComputedStyle(document.documentElement).getPropertyValue('--easeInOutQuart')
	}
);

GridSlidesController.registerTransition('slide-up',
	[{
		transform: 'translateY(100vh)'
	},{
		transform: 'translateY(0)'
	}],
	{
		duration: 500,
		easing: getComputedStyle(document.documentElement).getPropertyValue('--easeInOutQuart')
	}
);

GridSlidesController.registerTransition('fade', [
    {opacity: 0},
    {opacity: 1}
], {
    duration: 500,
    easing: 'ease'
});

GridSlidesController.registerTransition('none', [
    {display: 'none'},
    {display: 'flex'}
], {
    duration: 0
});

GridSlidesController.registerTransition('wipe', [
    {
        maskImage: 'linear-gradient(to bottom, transparent 33%, white 66%)',
        maskSize: '100% 300%',
        maskPositionY: '0%'
    },
    {
        maskImage: 'linear-gradient(to bottom, transparent 33%, white 66%)',
        maskSize: '100% 300%',
        maskPositionY: '100%'
    }
], {
    duration: 1000,
    easing: 'ease'
});