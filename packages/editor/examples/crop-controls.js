// RR-25: the playground's picture tools. A selected picture shows "Crop picture" on the canvas itself (src/image-cropper.js);
// this adds the same tools to the inspector, for the focal point and for a slide image (which has no canvas selection of its own).
import { describeImage } from '../src/image-crop.js';

export function installCropControls({ editor, getCanvas, getSelectedPath, getSlideIndex, status }) {
  const section = document.createElement('div');
  section.className = 'inspector-section picture-tools';
  section.id = 'picture-tools';
  section.hidden = true;
  section.innerHTML = '<div class="section-heading"><h2>Picture</h2></div>';
  const buttons = {};
  for (const [id, label] of [['crop-picture', 'Crop picture'], ['crop-focal', 'Set focal point'], ['crop-slide-image', 'Crop slide image']]) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = 'quiet full-width';
    button.style.marginBottom = '8px';
    button.textContent = label;
    buttons[id] = button;
    section.append(button);
  }
  const help = document.createElement('p');
  help.className = 'field-help';
  help.textContent = 'A crop is saved as a new picture asset, so the slide and the PowerPoint export show the same pixels. One Undo restores the previous picture.';
  section.append(help);
  document.getElementById('selection-controls').after(section);

  const slideImagePath = () => `slides.${getSlideIndex()}.design.slideImage`;
  function targets() {
    const selected = getSelectedPath();
    const picture = selected && !describeImage(editor.document, selected).error ? selected : null;
    const slideImage = !describeImage(editor.document, slideImagePath()).error ? slideImagePath() : null;
    return { picture, slideImage };
  }
  function refresh() {
    const { picture, slideImage } = targets();
    buttons['crop-picture'].hidden = buttons['crop-focal'].hidden = !picture;
    buttons['crop-slide-image'].hidden = !slideImage;
    section.hidden = !picture && !slideImage;
  }
  async function open(path, tool) {
    const canvas = getCanvas();
    if (!canvas) return;
    const opened = await canvas.cropImage(path, { tool });
    if (opened) status('Drag the handles to crop. Enter applies, Esc cancels.');
  }
  buttons['crop-picture'].addEventListener('click', () => open(targets().picture, 'crop'));
  buttons['crop-focal'].addEventListener('click', () => open(targets().picture, 'focus'));
  buttons['crop-slide-image'].addEventListener('click', () => open(targets().slideImage, 'crop'));
  editor.subscribe(refresh);
  refresh();
  return { refresh, open };
}
