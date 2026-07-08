export const HOME_WIDGET_NAME = 'HomeChecklistWidget';
export const WIDGET_COMPLETE_NEXT_TARGET = 'complete-next-item';

export type HomeChecklistWidgetProps = {
  title: string;
  completed: number;
  total: number;
  percentage: number;
  nextItemTitle?: string;
};

export const HomeWidget = {
  updateSnapshot(_props: HomeChecklistWidgetProps) {},
};
